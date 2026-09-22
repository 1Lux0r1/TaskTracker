/**
 * Заводит или обновляет администратора: npm run auth:admin
 * Параметры можно передать сразу:
 *   npm run auth:admin -- --email=ivanov@example.com --name="Иванов Иван" --password=…
 * Без --password скрипт придумает пароль сам и покажет его один раз.
 */
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { checkPasswordRules, hashPassword } from "../src/lib/password";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({
  url: path.isAbsolute(url) ? url : path.join(process.cwd(), url),
});
const prisma = new PrismaClient({ adapter });

function arg(name: string): string | undefined {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function ask(question: string, fallback = ""): Promise<string> {
  if (!process.stdin.isTTY) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer || fallback;
}

async function main() {
  const email = (arg("email") ?? (await ask("Рабочая почта: "))).trim().toLowerCase();
  if (!email) throw new Error("Нужна почта: по ней администратор входит");

  const existing = await prisma.member.findUnique({ where: { email } });
  const fullName = arg("name") ?? existing?.fullName ?? (await ask("ФИО: ", email));
  const generated = randomBytes(9).toString("base64url");
  const password = arg("password") ?? (await ask("Пароль (пусто — придумаю сам): ", generated));

  const problem = checkPasswordRules(password);
  if (problem) throw new Error(problem);

  const passwordHash = await hashPassword(password);
  const member = existing
    ? await prisma.member.update({
        where: { id: existing.id },
        data: { passwordHash, role: "ADMIN", isActive: true, fullName },
      })
    : await prisma.member.create({
        data: { email, fullName, role: "ADMIN", passwordHash },
      });

  console.log(`\nАдминистратор готов: ${member.fullName} <${member.email}>`);
  if (!arg("password")) console.log(`Пароль: ${password}`);
  console.log("Смените пароль после первого входа на странице «Мой профиль».\n");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
