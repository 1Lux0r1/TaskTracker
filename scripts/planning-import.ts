/**
 * Загрузка справочников планирования из книги «Планирование развития
 * системы»: подсистемы, МС, этапы, направления и их части.
 *
 *   npm run planning:import -- путь/к/книге.xlsx            пробный прогон
 *   npm run planning:import -- путь/к/книге.xlsx --apply    запись в базу
 *
 * Пробный прогон ничего не пишет: показывает, какие таблицы опознаны на
 * каких листах и сколько строк в каждой. Записи ищутся по коду (МС — по
 * номеру): повторная загрузка обновляет названия, а не плодит дубли.
 * Шифры задач после загрузки пересобираются.
 */
import ExcelJS from "exceljs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { type BookSheet, type Cell, parseBook } from "../src/lib/planning/book";
import { PLAN_CODE_PATTERN, PLAN_STAGE_CODE_PATTERN } from "../src/lib/planning/cipher";
import { recomputeCiphers } from "../src/lib/planning/service";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

function plain(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("result" in value) return plain(value.result as ExcelJS.CellValue);
  if ("text" in value) return String(value.text);
  return null;
}

async function readBook(file: string): Promise<BookSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return workbook.worksheets.map((sheet) => {
    const rows: Cell[][] = [];
    for (let r = 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const cells: Cell[] = [];
      for (let c = 1; c <= sheet.columnCount; c += 1) cells.push(plain(row.getCell(c).value));
      rows.push(cells);
    }
    return { name: sheet.name, rows };
  });
}

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const systemCode = process.argv.find((arg) => arg.startsWith("--system="))?.slice(9) ?? "RKII";
  if (!file) {
    console.error("Укажите путь к книге: npm run planning:import -- книга.xlsx [--apply]");
    process.exitCode = 1;
    return;
  }

  const sheets = await readBook(file);
  const book = parseBook(sheets);
  console.log(`Листы: ${sheets.map((sheet) => sheet.name).join(", ")}`);
  console.log(book.found.length ? book.found.join("\n") : "Ни одной таблицы справочника не опознано.");

  const problems: string[] = [];
  for (const item of [...book.subsystems, ...book.directions]) {
    if (!PLAN_CODE_PATTERN.test(item.code)) problems.push(`код «${item.code}» не годится для шифра`);
  }
  for (const item of book.parts) {
    if (!PLAN_CODE_PATTERN.test(item.code)) problems.push(`код части «${item.code}» не годится для шифра`);
  }
  for (const item of book.stages) {
    if (!PLAN_STAGE_CODE_PATTERN.test(item.code)) problems.push(`код этапа «${item.code}» не годится для шифра`);
  }
  const subsystemKeys = new Set(book.subsystems.flatMap((item) => [item.code, item.name]));
  const existingSubsystems = await prisma.planSubsystem.findMany({ include: { system: true } });
  for (const item of existingSubsystems) {
    if (item.system.code === systemCode) subsystemKeys.add(item.code).add(item.name);
  }
  for (const item of book.modules) {
    if (!subsystemKeys.has(item.subsystem)) {
      problems.push(`МС ${item.number} ${item.name}: подсистема «${item.subsystem}» не найдена`);
    }
  }
  if (problems.length) console.log(`\nЗамечания (${problems.length}):\n  ${problems.join("\n  ")}`);

  if (!apply) {
    console.log("\nПробный прогон: база не изменена. Записать — добавьте --apply.");
    return;
  }
  if (problems.length) {
    console.log("\nЗапись отменена: сначала поправьте замечания в книге.");
    process.exitCode = 1;
    return;
  }

  await prisma.$transaction(async (tx) => {
    const system = await tx.planSystem.upsert({
      where: { code: systemCode },
      update: {},
      create: { code: systemCode, name: "АИС РКИИЭ" },
    });

    for (const [index, stage] of book.stages.entries()) {
      await tx.planStage.upsert({
        where: { code: stage.code },
        update: { name: stage.name, level: stage.level, sortOrder: index },
        create: { ...stage, sortOrder: index },
      });
    }
    for (const [index, item] of book.subsystems.entries()) {
      await tx.planSubsystem.upsert({
        where: { systemId_code: { systemId: system.id, code: item.code } },
        update: { name: item.name, sortOrder: index },
        create: { systemId: system.id, code: item.code, name: item.name, sortOrder: index },
      });
    }
    const subsystems = await tx.planSubsystem.findMany({ where: { systemId: system.id } });
    const subsystemId = (key: string) =>
      subsystems.find((item) => item.code === key || item.name === key)!.id;

    for (const item of book.modules) {
      await tx.planModule.upsert({
        where: { systemId_number: { systemId: system.id, number: item.number } },
        update: { name: item.name, subsystemId: subsystemId(item.subsystem), version: item.version },
        create: {
          systemId: system.id,
          number: item.number,
          name: item.name,
          subsystemId: subsystemId(item.subsystem),
          version: item.version,
        },
      });
    }
    const maxNumber = Math.max(0, ...book.modules.map((item) => item.number));
    if (maxNumber > system.lastMsNumber) {
      await tx.planSystem.update({ where: { id: system.id }, data: { lastMsNumber: maxNumber } });
    }

    for (const [index, item] of book.directions.entries()) {
      const { code, ...fields } = item;
      await tx.planDirection.upsert({
        where: { systemId_code: { systemId: system.id, code } },
        update: { ...fields, sortOrder: index },
        create: { systemId: system.id, code, ...fields, sortOrder: index },
      });
    }
    const directions = await tx.planDirection.findMany({ where: { systemId: system.id } });
    for (const [index, item] of book.parts.entries()) {
      const direction = directions.find((d) => d.code === item.direction || d.name === item.direction);
      if (!direction) throw new Error(`Часть ${item.code}: направление «${item.direction}» не найдено`);
      await tx.planDirectionPart.upsert({
        where: { directionId_code: { directionId: direction.id, code: item.code } },
        update: { name: item.name, sortOrder: index },
        create: { directionId: direction.id, code: item.code, name: item.name, sortOrder: index },
      });
    }

    const changed = await recomputeCiphers(tx, system.id);
    console.log(
      `\nЗаписано: этапов ${book.stages.length}, подсистем ${book.subsystems.length}, МС ${book.modules.length}, ` +
        `направлений ${book.directions.length}, частей ${book.parts.length}; шифров пересобрано ${changed}.`,
    );
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
