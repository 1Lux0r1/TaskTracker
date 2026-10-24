/**
 * Загрузка книги «Планирование развития системы» из командной строки — то
 * же, что кнопка «Загрузить книгу» в справочниках модуля. Нужна для
 * установки и проверки без браузера.
 *
 *   npm run planning:import -- путь/к/книге.xlsx            проверка, база не меняется
 *   npm run planning:import -- путь/к/книге.xlsx --apply    запись в базу
 *   … --system=RKII                                         другая система книги
 */
import { readFileSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { readBookFile } from "../src/lib/planning/book-file";
import { importBook } from "../src/lib/planning/book-import";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const systemCode = process.argv.find((arg) => arg.startsWith("--system="))?.slice(9) ?? "RKII";
  if (!file) {
    console.error("Укажите путь к книге: npm run planning:import -- книга.xlsx [--apply]");
    process.exitCode = 1;
    return;
  }

  const result = await importBook(prisma, await readBookFile(readFileSync(file)), { systemCode, apply });
  console.log(`Книга: ${file}\n${result.found.join("\n")}`);
  console.log(`\n${apply ? "Записано" : "Будет записано"}:`);
  for (const [what, { created, updated }] of Object.entries(result.counts)) {
    console.log(`  ${what}: новых ${created}, обновлено ${updated}`);
  }
  if (result.problems.length) {
    console.log(`\nЗамечания по книге (${result.problems.length}):\n  ${result.problems.join("\n  ")}`);
  }
  if (!apply) console.log("\nПробный прогон: база не изменена. Записать — добавьте --apply.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
