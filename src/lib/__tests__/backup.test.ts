import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  backupNames,
  backupStamp,
  createBackup,
  listBackups,
  parseBackupName,
  restoreBackup,
  type BackupPaths,
} from "@/lib/backup";

let root: string;
let paths: BackupPaths;

function seed(migrations: string[]): void {
  const database = new Database(paths.databaseFile);
  database.exec("CREATE TABLE note (text TEXT)");
  database.exec(
    "CREATE TABLE _prisma_migrations (migration_name TEXT, finished_at TEXT, rolled_back_at TEXT)",
  );
  for (const name of migrations) {
    database.prepare("INSERT INTO _prisma_migrations VALUES (?, '2026-10-24', NULL)").run(name);
  }
  database.close();
}

function notes(file = paths.databaseFile): string[] {
  const database = new Database(file, { readonly: true });
  const rows = database.prepare("SELECT text FROM note ORDER BY text").all() as { text: string }[];
  database.close();
  return rows.map((row) => row.text);
}

function addNote(text: string): void {
  const database = new Database(paths.databaseFile);
  database.prepare("INSERT INTO note VALUES (?)").run(text);
  database.close();
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "tt-backup-"));
  paths = {
    backupDir: path.join(root, "backups"),
    databaseFile: path.join(root, "db.sqlite"),
    attachmentsDir: path.join(root, "attachments"),
    keep: 3,
  };
  mkdirSync(paths.attachmentsDir);
  seed(["001_init"]);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("имена копий", () => {
  it("узнаёт и старые имена без секунд, и новые", () => {
    expect(parseBackupName("2026-09-24-0300")).toEqual(new Date(2026, 8, 24, 3, 0, 0));
    expect(parseBackupName("2026-10-24-151207")).toEqual(new Date(2026, 9, 24, 15, 12, 7));
    expect(parseBackupName("2026-10-24-0300.before-restore")).toBeNull();
    expect(backupStamp(new Date(2026, 9, 24, 15, 12, 7))).toBe("2026-10-24-151207");
  });
});

describe("резервная копия", () => {
  it("снимает базу и вложения и показывает их в списке", async () => {
    addNote("первая");
    writeFileSync(path.join(paths.attachmentsDir, "a.txt"), "файл");

    const created = await createBackup(paths, { now: new Date(2026, 9, 24, 12, 0, 0) });

    expect(created.name).toBe("2026-10-24-120000");
    expect(notes(path.join(created.folder, "database.db"))).toEqual(["первая"]);
    const [info] = listBackups(paths);
    expect(info.attachmentFiles).toBe(1);
    expect(info.databaseBytes).toBeGreaterThan(0);
  });

  it("не перезаписывает копию с тем же временем", async () => {
    const now = new Date(2026, 9, 24, 12, 0, 0);
    await createBackup(paths, { now });
    await expect(createBackup(paths, { now })).rejects.toThrow(/уже есть/);
  });

  it("удаляет копии сверх предела, кроме защищённых", async () => {
    for (let minute = 0; minute < 3; minute++) {
      await createBackup(paths, { now: new Date(2026, 9, 24, 12, minute, 0) });
    }
    const oldest = "2026-10-24-120000";
    const created = await createBackup(paths, {
      now: new Date(2026, 9, 24, 12, 5, 0),
      protect: [oldest],
    });
    expect(created.removed).toEqual([]);
    const next = await createBackup(paths, { now: new Date(2026, 9, 24, 12, 6, 0) });
    expect(next.removed).toEqual([oldest, "2026-10-24-120100"]);
    expect(backupNames(paths)).toHaveLength(3);
  });
});

describe("восстановление", () => {
  it("возвращает данные и вложения, а текущее откладывает копией", async () => {
    addNote("было");
    writeFileSync(path.join(paths.attachmentsDir, "old.txt"), "старый");
    const saved = await createBackup(paths, { now: new Date(2026, 9, 24, 12, 0, 0) });

    addNote("стало");
    writeFileSync(path.join(paths.attachmentsDir, "new.txt"), "новый");

    // Приложение держит базу открытой во время восстановления.
    const live = new Database(paths.databaseFile);
    const restored = await restoreBackup(paths, saved.name, {
      now: new Date(2026, 9, 24, 13, 0, 0),
    });
    const seen = live.prepare("SELECT text FROM note ORDER BY text").all();
    live.close();

    expect(seen).toEqual([{ text: "было" }]);
    expect(notes()).toEqual(["было"]);
    expect(existsSync(path.join(paths.attachmentsDir, "new.txt"))).toBe(false);
    expect(readFileSync(path.join(paths.attachmentsDir, "old.txt"), "utf8")).toBe("старый");

    expect(restored.safetyCopy).toBe("2026-10-24-130000");
    expect(listBackups(paths)[0].note).toBe(`Перед восстановлением из копии ${saved.name}`);
    expect(notes(path.join(paths.backupDir, restored.safetyCopy, "database.db"))).toEqual([
      "было",
      "стало",
    ]);
  });

  it("не восстанавливает с экрана копию другой версии системы", async () => {
    const saved = await createBackup(paths, { now: new Date(2026, 9, 24, 12, 0, 0) });
    const database = new Database(paths.databaseFile);
    database.prepare("INSERT INTO _prisma_migrations VALUES ('002_next', '2026-10-24', NULL)").run();
    database.close();

    await expect(restoreBackup(paths, saved.name)).rejects.toThrow(/другой версии/);
    await expect(
      restoreBackup(paths, saved.name, { anyVersion: true, now: new Date(2026, 9, 24, 13, 0, 0) }),
    ).resolves.toMatchObject({ name: saved.name });
  });

  it("отказывает на чужое имя", async () => {
    await expect(restoreBackup(paths, "../etc")).rejects.toThrow(/Нет такой копии/);
  });
});
