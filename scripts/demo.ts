/**
 * Демонстрационный запуск одной командой: npm run demo
 *
 * Поднимает систему на отдельной базе `prisma/demo.db` с демонстрационными
 * данными и готовым администратором. Рабочую базу `prisma/dev.db` скрипт не
 * трогает вовсе, поэтому демо можно показывать, ничего не опасаясь.
 *
 * По умолчанию демо-база переиспользуется: что наменяли в прошлый раз, то и
 * осталось, и демо-данные заново не раскладываются. Начать с чистого листа —
 * `npm run demo -- --fresh`; только эта команда удаляет демо-базу, и больше
 * ничего.
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const DEMO_DB = "prisma/demo.db";
const DATABASE_URL = `file:./${DEMO_DB}`;
const PORT = process.env.PORT ?? "3000";

const ADMIN = {
  email: "admin@demo.local",
  fullName: "Королёв Сергей",
  displayName: "Сергей",
  password: "demo-2026",
};

const PARTICIPANT = {
  email: "user@demo.local",
  fullName: "Шаганова Елена",
  displayName: "Елена",
  password: "demo-2026",
};

const env = {
  ...process.env,
  DATABASE_URL,
  // Демо смотрят по обычному http, в том числе с соседнего компьютера: с
  // флагом Secure браузер отбросил бы cookie входа и войти было бы нельзя.
  SESSION_COOKIE_SECURE: "false",
};

function run(command: string): void {
  execSync(command, { stdio: "inherit", env });
}

function client(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: path.join(process.cwd(), DEMO_DB) }),
  });
}

/**
 * Демо-данные раскладываются только в пустую базу. Иначе повторный запуск
 * вернул бы задачу, которую на показе удалили или переименовали, — сид ищет
 * записи по названию и считает их пропавшими.
 */
async function isEmpty(): Promise<boolean> {
  const prisma = client();
  const projects = await prisma.project.count();
  await prisma.$disconnect();
  return projects === 0;
}

async function seedAccounts(): Promise<void> {
  const prisma = client();

  for (const [person, role] of [
    [ADMIN, "ADMIN"],
    [PARTICIPANT, "MEMBER"],
  ] as const) {
    const passwordHash = await hashPassword(person.password);
    await prisma.member.upsert({
      where: { email: person.email },
      update: { role, passwordHash, isActive: true },
      create: {
        email: person.email,
        fullName: person.fullName,
        displayName: person.displayName,
        role,
        passwordHash,
      },
    });
  }

  await prisma.$disconnect();
}

async function main(): Promise<void> {
  const fresh = process.argv.includes("--fresh");

  if (fresh) {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      const file = `${DEMO_DB}${suffix}`;
      if (existsSync(file)) rmSync(file);
    }
    console.log("Демо-база создаётся заново.");
  }

  console.log("Готовлю демо-базу…");
  run("npx prisma migrate deploy");

  if (await isEmpty()) {
    run("npm run db:seed");
    // Поиск по-русски живёт в отдельном поле: данные легли в базу мимо форм,
    // поэтому индекс надо собрать, иначе поиск будет молча пустым.
    run("npm run search:reindex");
  } else {
    console.log("Демо-база уже наполнена, оставляю как есть (начать заново — npm run demo -- --fresh).");
  }

  await seedAccounts();

  // Показываем собранное приложение, а не режим разработки: в нём страницы
  // открываются сразу и нет значка разработчика в углу.
  console.log("Собираю приложение…");
  run("npx next build");

  console.log(
    [
      "",
      "Демо готово. Откройте в браузере:",
      `  http://localhost:${PORT}`,
      "",
      "Вход администратора:",
      `  ${ADMIN.email} / ${ADMIN.password}`,
      "Вход участника (у него нет страницы «Сотрудники» и смены видимости):",
      `  ${PARTICIPANT.email} / ${PARTICIPANT.password}`,
      "",
      "Остановить — Ctrl+C. Рабочая база dev.db не тронута.",
      "",
    ].join("\n"),
  );

  // Слушаем на всех адресах: с демо часто заходят с соседнего компьютера.
  run(`npx next start -H 0.0.0.0 -p ${PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
