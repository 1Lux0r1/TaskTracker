import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// SQLite достаточно для команды до ~20 человек и не требует отдельного сервера.
// Для перехода на Postgres: сменить provider в schema.prisma и адаптер на PrismaPg.
const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

/**
 * Приводим относительный file:-путь к абсолютному. Prisma CLI трактует его
 * от корня проекта, и приложение должно открывать ровно тот же файл.
 */
function resolveSqliteFile(url: string): string {
  const raw = url.replace(/^file:/, "");
  if (raw === ":memory:" || path.isAbsolute(raw)) return raw;
  // turbopackIgnore: путь к файлу БД приходит из окружения в рантайме,
  // статически трассировать его содержимое не нужно.
  return path.join(/*turbopackIgnore: true*/ process.cwd(), raw);
}

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveSqliteFile(DATABASE_URL) });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
