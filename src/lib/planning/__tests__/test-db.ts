import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** Каталог миграций: проверки накатывают их на пустой файл SQLite. */
export const MIGRATIONS = path.join(process.cwd(), "prisma", "migrations");

/** Все миграции по порядку на пустую базу; рабочая база не трогается. */
export function applyMigrations(target: string): void {
  const db = new Database(target);
  for (const name of readdirSync(MIGRATIONS).filter((item) => /^\d+_/.test(item)).sort()) {
    db.exec(readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8"));
  }
  db.close();
}
