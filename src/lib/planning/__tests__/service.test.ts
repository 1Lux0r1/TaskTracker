import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { loadPlanningSample } from "../sample";
import { checkTaskDraft, recomputeCiphers } from "../service";

/**
 * Проверки на настоящей базе: все миграции накатываются на пустой файл
 * SQLite во временном каталоге, рабочая база не трогается.
 */
const MIGRATIONS = path.join(process.cwd(), "prisma", "migrations");
const PLANNING = readdirSync(MIGRATIONS).find((name) => name.endsWith("_planning_module"))!;

let dir: string;
let file: string;
let prisma: PrismaClient;

function applyMigrations(target: string): void {
  const db = new Database(target);
  for (const name of readdirSync(MIGRATIONS).filter((item) => /^\d+_/.test(item)).sort()) {
    db.exec(readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8"));
  }
  db.close();
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "planning-"));
  file = path.join(dir, "test.db");
  applyMigrations(file);
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
  await loadPlanningSample(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

async function ids() {
  const dk1 = await prisma.planDk.findFirstOrThrow({ where: { number: 1 } });
  const dk2 = await prisma.planDk.findFirstOrThrow({ where: { number: 2 } });
  const ms08 = await prisma.planModule.findFirstOrThrow({ where: { number: 8 } });
  const stage = async (code: string) => (await prisma.planStage.findUniqueOrThrow({ where: { code } })).id;
  return { dk1: dk1.id, dk2: dk2.id, ms08: ms08.id, stage };
}

describe("тестовый пример", () => {
  it("загружается с шифрами из методики, включая возвраты", async () => {
    const ciphers = (await prisma.planTask.findMany({ select: { cipher: true } })).map((t) => t.cipher);
    expect(ciphers).toHaveLength(10);
    expect(ciphers).toEqual(
      expect.arrayContaining([
        "RKII.Gaz.Rte.TA.01.08.СА",
        "RKII.Gaz.Rte.TA.01.08.Р",
        "RKII.Gaz.Rte.TA.01.08.Р2",
        "RKII.Gaz.Rte.TA.01.08.СА2",
        "RKII.Gaz.Rte.TA.01.08.Т2",
        "RKII.Gaz.Rte.TA.01.08.Док",
        "RKII.Gaz.Rte.TA.01.08.DO",
        "RKII.Gaz.Rte.TA.02.БА",
        "RKII.Gaz.Rte.TA.02.Арх",
      ]),
    );
  });

  it("повторная загрузка ничего не дублирует", async () => {
    expect((await loadPlanningSample(prisma)).tasks).toBe(0);
    expect(await prisma.planTask.count()).toBe(10);
  });
});

describe("черновик задачи", () => {
  it("после Р и Р2 предлагает Р3", async () => {
    const { dk1, ms08, stage } = await ids();
    const check = await checkTaskDraft(prisma, { dkId: dk1, stageId: await stage("Р"), moduleId: ms08, repeat: null });
    expect(check).toEqual({ ok: true, cipher: "RKII.Gaz.Rte.TA.01.08.Р3", repeat: 3 });
  });

  it("первая задача этапа идёт без номера", async () => {
    const { dk1, ms08, stage } = await ids();
    const check = await checkTaskDraft(prisma, { dkId: dk1, stageId: await stage("Внед"), moduleId: ms08, repeat: null });
    expect(check).toEqual({ ok: true, cipher: "RKII.Gaz.Rte.TA.01.08.Внед", repeat: 1 });
  });

  it("предупреждает о дубле и называет свободный номер", async () => {
    const { dk1, ms08, stage } = await ids();
    const check = await checkTaskDraft(prisma, { dkId: dk1, stageId: await stage("Р"), moduleId: ms08, repeat: 2 });
    expect(check).toEqual({
      ok: false,
      error: "Шифр RKII.Gaz.Rte.TA.01.08.Р2 уже есть в плане. Следующий свободный номер повтора — 3",
    });
  });

  it("этап по МС без МС отклоняется", async () => {
    const { dk1, stage } = await ids();
    const check = await checkTaskDraft(prisma, { dkId: dk1, stageId: await stage("Р"), moduleId: null, repeat: null });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.error).toContain("ведётся по МС");
  });

  it("архитектура с МС отклоняется: Арх ведётся на ДК", async () => {
    const { dk2, ms08, stage } = await ids();
    const check = await checkTaskDraft(prisma, { dkId: dk2, stageId: await stage("Арх"), moduleId: ms08, repeat: null });
    expect(check.ok).toBe(false);
  });

  it("БА с МС ведётся на МС", async () => {
    const { dk2, ms08, stage } = await ids();
    const check = await checkTaskDraft(prisma, { dkId: dk2, stageId: await stage("БА"), moduleId: ms08, repeat: null });
    expect(check).toEqual({ ok: true, cipher: "RKII.Gaz.Rte.TA.02.08.БА", repeat: 1 });
  });

  it("неизвестный МС и ДК отклоняются", async () => {
    const { dk1, stage } = await ids();
    expect((await checkTaskDraft(prisma, { dkId: dk1, stageId: await stage("Р"), moduleId: "нет", repeat: null })).ok).toBe(false);
    expect((await checkTaskDraft(prisma, { dkId: "нет", stageId: await stage("Р"), moduleId: null, repeat: null })).ok).toBe(false);
  });
});

describe("целостность в базе", () => {
  it("шифр уникален", async () => {
    const task = await prisma.planTask.findFirstOrThrow();
    await expect(
      prisma.planTask.create({
        data: { dkId: task.dkId, stageId: task.stageId, cipher: task.cipher, name: "дубль" },
      }),
    ).rejects.toThrow();
  });

  it("номер ДК уникален в блоке", async () => {
    const dk = await prisma.planDk.findFirstOrThrow({ where: { number: 1 } });
    await expect(prisma.planDk.create({ data: { partId: dk.partId, number: 1, name: "дубль" } })).rejects.toThrow();
  });

  it("МС с задачами не удаляется", async () => {
    const { ms08 } = await ids();
    await expect(prisma.planModule.delete({ where: { id: ms08 } })).rejects.toThrow();
  });
});

describe("пересборка шифров", () => {
  it("смена кода подсистемы переписывает шифры задач", async () => {
    const subsystem = await prisma.planSubsystem.findFirstOrThrow({ where: { code: "TA" } });
    await prisma.planSubsystem.update({ where: { id: subsystem.id }, data: { code: "TB" } });
    const changed = await recomputeCiphers(prisma, subsystem.systemId);
    expect(changed).toBe(10);
    expect(await prisma.planTask.count({ where: { cipher: { startsWith: "RKII.Gaz.Rte.TB." } } })).toBe(10);
    const task = await prisma.planTask.findFirstOrThrow({ where: { cipher: "RKII.Gaz.Rte.TB.01.08.Р2" } });
    expect(task.searchIndex).toContain("rkii.gaz.rte.tb.01.08.р2");

    await prisma.planSubsystem.update({ where: { id: subsystem.id }, data: { code: "TA" } });
    await recomputeCiphers(prisma, subsystem.systemId);
  });
});

describe("откат миграции", () => {
  it("down.sql убирает только таблицы модуля, повторный накат проходит", () => {
    const copy = path.join(dir, "rollback.db");
    applyMigrations(copy);
    const db = new Database(copy);
    const tables = () =>
      (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
    // В рабочей базе журнал миграций ведёт Prisma; здесь заводим его сами.
    db.exec(
      `CREATE TABLE "_prisma_migrations" ("migration_name" TEXT); INSERT INTO "_prisma_migrations" VALUES ('${PLANNING}')`,
    );
    const before = tables();
    db.exec(readFileSync(path.join(MIGRATIONS, PLANNING, "down.sql"), "utf8"));
    const after = tables();
    expect(after.some((name) => name.startsWith("Plan"))).toBe(false);
    expect(before.filter((name) => !name.startsWith("Plan")).sort()).toEqual(after.sort());
    expect(db.prepare(`SELECT count(*) AS n FROM "_prisma_migrations"`).get()).toEqual({ n: 0 });
    db.exec(readFileSync(path.join(MIGRATIONS, PLANNING, "migration.sql"), "utf8"));
    expect(tables().filter((name) => name.startsWith("Plan"))).toHaveLength(8);
    db.close();
  });
});
