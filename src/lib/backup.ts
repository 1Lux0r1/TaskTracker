/**
 * Резервные копии и восстановление. Этим модулем пользуются и раздел
 * «Обслуживание», и команда `npm run backup` из планировщика.
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
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type BackupPaths = {
  backupDir: string;
  databaseFile: string;
  attachmentsDir: string;
  /** Сколько копий храним: по умолчанию две недели ежедневных. */
  keep: number;
};

export type BackupInfo = {
  name: string;
  createdAt: Date;
  /** Размер базы в копии, байт. */
  databaseBytes: number;
  /** Сколько файлов вложений в копии. */
  attachmentFiles: number;
  /** Пометка, зачем снята копия: например, перед восстановлением. */
  note: string | null;
};

/** Пути берутся из окружения так же, как их берёт само приложение. */
export function backupPaths(env: NodeJS.ProcessEnv = process.env): BackupPaths {
  // turbopackIgnore: пути приходят из окружения в рантайме.
  const root = /*turbopackIgnore: true*/ process.cwd();
  return {
    backupDir: path.resolve(root, env.BACKUP_DIR ?? "backups"),
    databaseFile: path.resolve(
      root,
      (env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, ""),
    ),
    attachmentsDir: path.resolve(root, env.ATTACHMENTS_DIR ?? "var/attachments"),
    keep: Number(env.BACKUP_KEEP ?? 14),
  };
}

/**
 * Имя копии — время снятия. Секунды появились, когда копии стали снимать
 * кнопкой: две копии в одну минуту иначе легли бы в один каталог. Старые
 * имена без секунд по-прежнему узнаются и сортируются правильно.
 */
const NAME = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})?$/;

export function backupStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds()),
  ].join("-");
}

/** Время снятия по имени копии, или null для чужого каталога. */
export function parseBackupName(name: string): Date | null {
  const match = NAME.exec(name);
  if (!match) return null;
  const [, year, month, day, hours, minutes, seconds] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds ?? 0),
  );
}

/** Файл с пометкой внутри копии. */
const NOTE_FILE = "note.txt";

/** Имена копий от старой к новой. */
export function backupNames(paths: BackupPaths): string[] {
  if (!existsSync(paths.backupDir)) return [];
  return readdirSync(paths.backupDir)
    .filter((name) => parseBackupName(name) !== null)
    .filter((name) => statSync(path.join(paths.backupDir, name)).isDirectory())
    .sort();
}

/** Копии с подробностями, свежие сверху — так их показывает экран. */
export function listBackups(paths: BackupPaths): BackupInfo[] {
  return backupNames(paths)
    .reverse()
    .map((name) => {
      const folder = path.join(paths.backupDir, name);
      const database = path.join(folder, "database.db");
      return {
        name,
        createdAt: parseBackupName(name) as Date,
        databaseBytes: existsSync(database) ? statSync(database).size : 0,
        attachmentFiles: countFiles(path.join(folder, "attachments")),
        note: existsSync(path.join(folder, NOTE_FILE))
          ? readFileSync(path.join(folder, NOTE_FILE), "utf8").trim() || null
          : null,
      };
    });
}

function countFiles(folder: string): number {
  if (!existsSync(folder)) return 0;
  return readdirSync(folder, { recursive: true }).filter((entry) =>
    statSync(path.join(folder, String(entry))).isFile(),
  ).length;
}

export type CreatedBackup = {
  name: string;
  folder: string;
  tables: number;
  /** Копии, удалённые сверх предела хранения. */
  removed: string[];
};

/**
 * Снимает копию. `protect` — копии, которые нельзя удалить при чистке
 * старых: перед восстановлением это копия, из которой восстанавливаемся.
 */
export async function createBackup(
  paths: BackupPaths,
  options: { now?: Date; protect?: string[]; note?: string } = {},
): Promise<CreatedBackup> {
  if (!existsSync(paths.databaseFile)) {
    throw new Error(`Базы нет: ${paths.databaseFile}. Проверьте DATABASE_URL.`);
  }

  const name = backupStamp(options.now ?? new Date());
  const folder = path.join(paths.backupDir, name);
  // Перезапись существующей копии потеряла бы её: лучше попросить повторить.
  if (existsSync(folder)) {
    throw new Error("Копия с этим временем уже есть, повторите через секунду");
  }
  mkdirSync(folder, { recursive: true });

  // Онлайн-бэкап средствами SQLite: копия согласована, даже если в этот
  // момент кто-то работает в системе.
  const database = new Database(paths.databaseFile, { readonly: true });
  try {
    await database.backup(path.join(folder, "database.db"));
  } finally {
    database.close();
  }

  if (existsSync(paths.attachmentsDir)) {
    cpSync(paths.attachmentsDir, path.join(folder, "attachments"), { recursive: true });
  }

  // Проверяем, что копия открывается и в ней есть таблицы: копия, которую
  // никто не проверил, — это не копия.
  const tables = countTables(path.join(folder, "database.db"));
  if (tables === 0) throw new Error("Копия открылась, но таблиц в ней нет");
  if (options.note) writeFileSync(path.join(folder, NOTE_FILE), options.note);

  const protect = new Set([name, ...(options.protect ?? [])]);
  const all = backupNames(paths);
  const removed = all
    .slice(0, Math.max(all.length - paths.keep, 0))
    .filter((old) => !protect.has(old));
  for (const old of removed) {
    rmSync(path.join(paths.backupDir, old), { recursive: true, force: true });
  }

  return { name, folder, tables, removed };
}

function countTables(file: string): number {
  const check = new Database(file, { readonly: true });
  try {
    const row = check
      .prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'")
      .get() as { count: number };
    return row.count;
  } finally {
    check.close();
  }
}

/** Применённые миграции базы: по ним видно, той ли версии системы копия. */
function appliedMigrations(file: string): string[] {
  const database = new Database(file, { readonly: true });
  try {
    const table = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'")
      .get();
    if (!table) return [];
    const rows = database
      .prepare(
        "SELECT migration_name AS name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
      )
      .all() as { name: string }[];
    return rows.map((row) => row.name).sort();
  } finally {
    database.close();
  }
}

export type RestoredBackup = {
  name: string;
  /** Копия текущих данных, снятая перед восстановлением. */
  safetyCopy: string;
};

/**
 * Восстановление. Перед ним снимается копия текущего состояния: если
 * восстановились не из той копии, вернуться можно тем же способом.
 *
 * База переписывается онлайн-бэкапом поверх работающего файла, а не заменой
 * файла: приложение держит базу открытой, а Windows не даёт переименовать
 * открытый файл. Остальные соединения увидят новые данные со следующего
 * запроса.
 *
 * Копия другой версии системы (другой набор миграций) с экрана не
 * восстанавливается: структура базы разошлась бы с кодом. Команда
 * восстанавливает её с `anyVersion`, а затем миграции доводят базу до кода.
 */
export async function restoreBackup(
  paths: BackupPaths,
  name: string,
  options: { now?: Date; anyVersion?: boolean } = {},
): Promise<RestoredBackup> {
  if (parseBackupName(name) === null) throw new Error("Нет такой копии");
  const source = path.join(paths.backupDir, name);
  const sourceDatabase = path.join(source, "database.db");
  if (!existsSync(sourceDatabase)) throw new Error(`Копии ${name} нет`);

  if (existsSync(paths.databaseFile) && !options.anyVersion) {
    const current = appliedMigrations(paths.databaseFile);
    const saved = appliedMigrations(sourceDatabase);
    if (current.join("\n") !== saved.join("\n")) {
      throw new Error(
        `Копия ${name} снята на другой версии системы (миграций в копии ${saved.length}, ` +
          `в системе ${current.length}). Восстановите её командой ` +
          `«npm run backup -- --restore ${name}» и затем «npm run db:deploy».`,
      );
    }
  }

  const safety = existsSync(paths.databaseFile)
    ? await createBackup(paths, {
        now: options.now,
        protect: [name],
        note: `Перед восстановлением из копии ${name}`,
      })
    : null;

  mkdirSync(path.dirname(paths.databaseFile), { recursive: true });
  const backup = new Database(sourceDatabase, { readonly: true });
  try {
    await backup.backup(paths.databaseFile);
  } finally {
    backup.close();
  }

  // Прежние вложения уже лежат в страховочной копии, поэтому каталог
  // заменяется целиком: файлы, которых не было в копии, не должны остаться.
  rmSync(paths.attachmentsDir, { recursive: true, force: true });
  if (existsSync(path.join(source, "attachments"))) {
    cpSync(path.join(source, "attachments"), paths.attachmentsDir, { recursive: true });
  }

  return { name, safetyCopy: safety?.name ?? "" };
}
