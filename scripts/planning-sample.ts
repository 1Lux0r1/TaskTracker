/**
 * Тестовый пример модуля «Планирование развития»: этапы методики, система
 * RKII, направление Gaz, блок Rte, ДК 01 и 02, МС 08 terra-analyser-bff и
 * десять задач плана, включая возвраты СА2, Р2, Т2.
 *
 * Запуск: npm run planning:sample. Повторный запуск ничего не дублирует.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadPlanningSample } from "../src/lib/planning/sample";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

loadPlanningSample(prisma)
  .then(({ tasks }) => {
    console.log(
      tasks > 0
        ? `Тестовый пример загружен: задач плана добавлено — ${tasks}.`
        : "Тестовый пример уже загружен, ничего не добавлено.",
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
