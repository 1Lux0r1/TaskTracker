import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { importBook } from "../book-import";
import { BOOK } from "./book-fixture";
import { applyMigrations } from "./test-db";

let dir: string;
let prisma: PrismaClient;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "planning-book-"));
  const file = path.join(dir, "test.db");
  applyMigrations(file);
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("загрузка книги", () => {
  it("проверка считает, что ляжет, и ничего не пишет", async () => {
    const result = await importBook(prisma, BOOK, { apply: false });
    expect(result.applied).toBe(false);
    expect(result.counts["задачи плана"]).toEqual({ created: 3, updated: 0 });
    expect(result.problems).toContain("«План работ», строка 8, TA.1.Ого: этапа «Ого» нет в справочнике");
    expect(await prisma.planTask.count()).toBe(0);
    expect(await prisma.planSystem.count()).toBe(0);
  });

  it("запись кладёт задачи с шифрами книги, повторная — обновляет", async () => {
    await importBook(prisma, BOOK, { apply: true });
    const ciphers = (await prisma.planTask.findMany({ select: { cipher: true } })).map((task) => task.cipher).sort();
    expect(ciphers).toEqual(["RKII.Base.1.1.TA.3.Арх", "RKII.TATep.1.1.TA.1.Р", "RKII.TATep.1.1.TA.1.Р2"]);
    const dk = await prisma.planDk.findFirstOrThrow({ where: { name: "Path-finder" } });
    expect(dk.note).toBe("Отв. по книге: ОА");

    const again = await importBook(prisma, BOOK, { apply: true });
    expect(again.counts["задачи плана"]).toEqual({ created: 0, updated: 3 });
    expect(await prisma.planTask.count()).toBe(3);
  });
});
