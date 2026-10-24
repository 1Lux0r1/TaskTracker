/**
 * Пересобирает поисковый индекс: npm run search:reindex
 * То же делает кнопка в разделе «Обслуживание». Сама работа — в
 * src/lib/search-reindex.ts.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { reindexSearch } from "../src/lib/search-reindex";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main(): Promise<void> {
  const counts = await reindexSearch(prisma);
  console.log(
    `Поиск пересобран: задач ${counts.tasks}, писем ${counts.letters}, ` +
      `документов ${counts.documents}, встреч ${counts.meetings}, ` +
      `страниц справочника ${counts.pages}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
