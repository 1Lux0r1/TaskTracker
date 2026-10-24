import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { parsePlanPeriod } from "../period";
import { loadPlanningSample } from "../sample";
import { applyMigrations } from "./test-db";

/**
 * Выгрузка плана на тестовом примере. Клиент базы подменяется до загрузки
 * модулей экрана: они берут его из @/lib/db.
 */
let dir: string;
let prisma: PrismaClient;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "planning-export-"));
  const file = path.join(dir, "test.db");
  applyMigrations(file);
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
  await loadPlanningSample(prisma);
  (globalThis as { prisma?: PrismaClient }).prisma = prisma;
});

afterAll(async () => {
  await prisma.$disconnect();
  delete (globalThis as { prisma?: PrismaClient }).prisma;
  rmSync(dir, { recursive: true, force: true });
});

async function build(params: Record<string, string>, q = "") {
  const { loadPlanTree } = await import("../queries");
  const { planSpan, planView } = await import("../plan-view");
  const { buildPlanWorkbook } = await import("../export");
  const system = await prisma.planSystem.findFirstOrThrow();
  const directions = await loadPlanTree(system.id);
  const today = new Date(2026, 9, 24);
  const period = parsePlanPeriod(params, today, planSpan(directions));
  const workbook = buildPlanWorkbook({ system, period, query: q, blocks: planView(directions, { q, period }), today });
  // Через файл и обратно: так проверяется то, что откроет Excel.
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(await workbook.xlsx.writeBuffer());
  return reread;
}

function rows(sheet: ExcelJS.Worksheet) {
  const result: { values: unknown[]; row: ExcelJS.Row }[] = [];
  sheet.eachRow((row) => result.push({ values: (row.values as unknown[]).slice(1), row }));
  return result;
}

describe("выгрузка плана в Excel", () => {
  it("кладёт блок, ДК и задачи с шифрами и кодами МС, как в книге", async () => {
    const workbook = await build({ period: "custom", from: "2026-10", to: "2026-12", scale: "month" });
    const sheet = workbook.getWorksheet("План работ")!;
    const all = rows(sheet);
    expect(all[0].values[0]).toBe("План работ · RKII АИС РКИИЭ · окт 2026 – дек 2026, по месяцам");
    expect(all[2].values.slice(0, 9)).toEqual(["Код Бизнес", "Код МС", "Шифр", "Наименование", "Статус", "Срок", "Старт", "Финиш", "Недель"]);
    expect(all[2].values.slice(9)).toEqual(["окт", "ноя", "дек"]);

    const task = all.find((item) => item.values[2] === "RKII.Gaz.Rte.1.TA.3.Р2")!;
    expect(task.values[0]).toBe("RKII.Gaz.Rte.1");
    expect(task.values[1]).toBe("TA.3.Р2");
    // Доработка 23.11 – 06.12: закрашены ноябрь и декабрь, октябрь пуст.
    const fillOf = (column: number) => (task.row.getCell(column).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;
    expect(fillOf(10)).toBeUndefined();
    expect(fillOf(11)).toBe("FFEF4444");
    expect(fillOf(12)).toBe("FFEF4444");
    expect(all.filter((item) => typeof item.values[2] === "string" && String(item.values[2]).startsWith("RKII."))).toHaveLength(10);
  });

  it("по неделям — колонка на неделю, задачи вне периода не попадают", async () => {
    const workbook = await build({ period: "custom", from: "2026-12", to: "2026-12", scale: "week" });
    const sheet = workbook.getWorksheet("План работ")!;
    const all = rows(sheet);
    expect(all[2].values.slice(9)).toEqual(["49", "50", "51", "52", "53"]);
    const ciphers = all.map((item) => item.values[2]).filter((value) => typeof value === "string");
    expect(ciphers).toContain("RKII.Gaz.Rte.1.TA.3.Экс");
    expect(ciphers).not.toContain("RKII.Gaz.Rte.1.TA.3.СА");
  });

  it("пишет параметры выгрузки и поиск", async () => {
    const workbook = await build({ period: "year", scale: "week" }, "рте.2");
    const about = rows(workbook.getWorksheet("Параметры")!);
    expect(about[1].values).toEqual(["Период", "янв 2026 – дек 2026, по неделям"]);
    expect(about[4].values).toEqual(["Поиск", "рте.2"]);
  });
});
