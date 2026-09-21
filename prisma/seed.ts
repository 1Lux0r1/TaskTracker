/**
 * Демонстрационные данные: два проекта, команда и задачи с разными статусами.
 * Запуск: npm run db:seed. Скрипт идемпотентен — повторный прогон не плодит дубли.
 */
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({
  url: path.isAbsolute(url) ? url : path.join(process.cwd(), url),
});
const prisma = new PrismaClient({ adapter });

const MEMBERS = [
  { fullName: "Иванов Иван", position: "Руководитель проектов", email: "ivanov@example.com" },
  { fullName: "Петрова Мария", position: "Аналитик", email: "petrova@example.com" },
  { fullName: "Сидоров Алексей", position: "Разработчик", email: "sidorov@example.com" },
  { fullName: "Кузнецова Ольга", position: "Тестировщик", email: "kuznetsova@example.com" },
];

const day = 86_400_000;
const today = new Date();

function shift(days: number): Date {
  return new Date(today.getTime() + days * day);
}

async function main() {
  const members = [];
  for (const data of MEMBERS) {
    members.push(
      await prisma.member.upsert({
        where: { email: data.email },
        update: data,
        create: data,
      }),
    );
  }
  const [ivanov, petrova, sidorov, kuznetsova] = members;

  const erp = await prisma.project.upsert({
    where: { code: "ERP" },
    update: {},
    create: {
      code: "ERP",
      name: "Внедрение ERP",
      description: "Перевод учёта из электронных таблиц в единую систему",
      status: "ACTIVE",
      startDate: shift(-40),
      dueDate: shift(60),
      ownerId: ivanov.id,
    },
  });

  const site = await prisma.project.upsert({
    where: { code: "SITE" },
    update: {},
    create: {
      code: "SITE",
      name: "Новый корпоративный сайт",
      status: "PLANNED",
      startDate: shift(14),
      dueDate: shift(120),
      ownerId: petrova.id,
    },
  });

  const tasks = [
    {
      projectId: erp.id,
      title: "Собрать требования от бухгалтерии",
      status: "DONE",
      priority: "HIGH",
      assigneeId: petrova.id,
      startDate: shift(-38),
      dueDate: shift(-25),
      estimateHours: 24,
      spentHours: 27,
      progress: 100,
    },
    {
      projectId: erp.id,
      title: "Описать справочник номенклатуры",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: petrova.id,
      startDate: shift(-20),
      dueDate: shift(5),
      estimateHours: 40,
      spentHours: 22,
      progress: 55,
    },
    {
      projectId: erp.id,
      title: "Настроить выгрузку проводок",
      status: "TODO",
      priority: "CRITICAL",
      assigneeId: sidorov.id,
      dueDate: shift(-3),
      estimateHours: 32,
      progress: 0,
    },
    {
      projectId: erp.id,
      title: "Провести приёмочное тестирование",
      status: "BACKLOG",
      priority: "MEDIUM",
      assigneeId: kuznetsova.id,
      dueDate: shift(45),
      estimateHours: 56,
      progress: 0,
    },
    {
      projectId: erp.id,
      title: "Обучить пользователей",
      status: "BACKLOG",
      priority: "LOW",
      dueDate: shift(55),
      estimateHours: 16,
      progress: 0,
    },
    {
      projectId: site.id,
      title: "Утвердить структуру разделов",
      status: "REVIEW",
      priority: "MEDIUM",
      assigneeId: petrova.id,
      dueDate: shift(10),
      estimateHours: 12,
      spentHours: 10,
      progress: 80,
    },
    {
      projectId: site.id,
      title: "Подготовить дизайн-макеты",
      status: "TODO",
      priority: "HIGH",
      dueDate: shift(30),
      estimateHours: 60,
      progress: 0,
    },
  ];

  for (const [index, task] of tasks.entries()) {
    const number = index + 1;
    const existing = await prisma.task.findFirst({
      where: { projectId: task.projectId, title: task.title },
    });
    if (existing) continue;

    await prisma.task.create({
      data: {
        ...task,
        number: await nextNumber(task.projectId),
        sortOrder: number,
        completedAt: task.status === "DONE" ? shift(-25) : null,
      },
    });
  }

  const total = await prisma.task.count();
  console.log(`Готово: ${await prisma.project.count()} проекта, ${total} задач, ${members.length} сотрудника.`);
}

async function nextNumber(projectId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
