/**
 * Резервная копия и восстановление.
 *
 *   npm run backup                  — снять копию
 *   npm run backup -- --list        — показать, какие копии есть
 *   npm run backup -- --restore ГГГГ-ММ-ДД-ЧЧММ   — восстановить из копии
 *
 * База копируется средствами самой SQLite (онлайн-бэкап), а не копированием
 * файла: копия файла «на ходу» может оказаться повреждённой, если в этот
 * момент шла запись. Вместе с базой копируется каталог вложений — без него
 * записи останутся, а файлы к ним пропадут.
 *
 * Куда складывать копии, задаёт BACKUP_DIR; по умолчанию каталог `backups`
 * рядом с проектом. Для настоящего восстановления этот каталог должен лежать
 * не на том же диске, что система: облачный диск или внешний носитель.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** Сколько копий храним: две недели ежедневных. */
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);

const root = process.cwd();
const backupDir = path.resolve(root, process.env.BACKUP_DIR ?? "backups");
const databaseFile = path.resolve(
  root,
  (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, ""),
);
const attachmentsDir = path.resolve(root, process.env.ATTACHMENTS_DIR ?? "var/attachments");

function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()) + pad(date.getMinutes()),
  ].join("-");
}

function copies(): string[] {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-\d{4}$/.test(name))
    .filter((name) => statSync(path.join(backupDir, name)).isDirectory())
    .sort();
}

async function create(): Promise<void> {
  if (!existsSync(databaseFile)) {
    throw new Error(`Базы нет: ${databaseFile}. Проверьте DATABASE_URL.`);
  }

  const target = path.join(backupDir, stamp(new Date()));
  mkdirSync(target, { recursive: true });

  // Онлайн-бэкап средствами SQLite: копия согласована, даже если в этот
  // момент кто-то работает в системе.
  const database = new Database(databaseFile, { readonly: true });
  await database.backup(path.join(target, "database.db"));
  database.close();

  if (existsSync(attachmentsDir)) {
    cpSync(attachmentsDir, path.join(target, "attachments"), { recursive: true });
  }

  // Проверяем, что копия открывается и в ней есть таблицы: копия, которую
  // никто не проверил, — это не копия.
  const check = new Database(path.join(target, "database.db"), { readonly: true });
  const tables = check
    .prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'")
    .get() as { count: number };
  check.close();
  if (tables.count === 0) throw new Error("Копия открылась, но таблиц в ней нет");

  const extra = copies().slice(0, Math.max(copies().length - KEEP, 0));
  for (const old of extra) rmSync(path.join(backupDir, old), { recursive: true, force: true });

  console.log(`Копия готова: ${target}`);
  console.log(`Таблиц в копии: ${tables.count}. Храним последние ${KEEP}.`);
  if (extra.length > 0) console.log(`Удалены старые копии: ${extra.join(", ")}`);
}

/**
 * Восстановление: прежние база и вложения не удаляются, а откладываются в
 * сторону с отметкой времени. Если восстановились не из той копии, вернуть
 * всё назад можно переименованием.
 */
function restore(name: string): void {
  const source = path.join(backupDir, name);
  if (!existsSync(source)) {
    throw new Error(`Копии ${name} нет. Список: npm run backup -- --list`);
  }

  const aside = `.before-restore-${stamp(new Date())}`;
  if (existsSync(databaseFile)) renameSync(databaseFile, `${databaseFile}${aside}`);
  if (existsSync(attachmentsDir)) renameSync(attachmentsDir, `${attachmentsDir}${aside}`);

  mkdirSync(path.dirname(databaseFile), { recursive: true });
  cpSync(path.join(source, "database.db"), databaseFile);
  if (existsSync(path.join(source, "attachments"))) {
    cpSync(path.join(source, "attachments"), attachmentsDir, { recursive: true });
  }

  console.log(`Восстановлено из ${name}.`);
  console.log(`Прежние данные отложены с окончанием «${aside}», удалите их, когда убедитесь.`);
  console.log("Дальше запустите: npm run db:deploy");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    const list = copies();
    console.log(list.length === 0 ? `Копий нет: ${backupDir}` : list.join("\n"));
    return;
  }

  const restoreIndex = args.indexOf("--restore");
  if (restoreIndex !== -1) {
    const name = args[restoreIndex + 1];
    if (!name) throw new Error("Укажите копию: npm run backup -- --restore 2026-09-24-0300");
    restore(name);
    return;
  }

  await create();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
