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

  // Треки — справочник проекта, поэтому демо-проекты получают базовый набор.
  const BASE_TRACKS = [
    { key: "PRODUCTION", name: "Производственный", color: "blue", sortOrder: 0 },
    { key: "INTERNAL", name: "Внутренний", color: "gray", sortOrder: 1 },
    { key: "EXTERNAL", name: "Внешний", color: "orange", sortOrder: 2 },
    { key: "LEGAL", name: "Юридический", color: "purple", sortOrder: 3 },
  ];

  const trackByProject = new Map<string, string>();
  for (const project of [erp, site]) {
    for (const track of BASE_TRACKS) {
      const existing = await prisma.track.findFirst({
        where: { projectId: project.id, name: track.name },
      });
      const row = existing ?? (await prisma.track.create({ data: { projectId: project.id, ...track } }));
      if (track.key === "PRODUCTION") trackByProject.set(project.id, row.id);
    }
  }

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
        trackId: trackByProject.get(task.projectId)!,
        number: await nextNumber(task.projectId),
        sortOrder: number,
        completedAt: task.status === "DONE" ? shift(-25) : null,
      },
    });
  }

  await seedLegalTrack(erp.id, ivanov.id, petrova.id);
  await seedMeetings(erp.id, ivanov.id, [petrova.id, sidorov.id, kuznetsova.id]);

  console.log(
    [
      `проектов: ${await prisma.project.count()}`,
      `задач: ${await prisma.task.count()}`,
      `писем: ${await prisma.letter.count()}`,
      `документов: ${await prisma.document.count()}`,
      `сотрудников: ${members.length}`,
    ].join(", "),
  );
}

/**
 * Юридический трек: переписка и документ с тремя сторонами подписания —
 * чтобы на демо-данных было видно, как считается итоговый статус.
 */
async function seedLegalTrack(
  projectId: string,
  ownerId: string,
  analystId: string,
): Promise<void> {
  // «Наша» организация тоже живёт в справочнике: по этой отметке видно,
  // ждёт ли документ нашей подписи или чужой. Соседний департамент (ДЖКХ) —
  // внешняя сторона, хотя и подписывает вместе с нами.
  const counterparties = [
    { name: "ДИТ", isInternal: true },
    { name: "ДЖКХ", isInternal: false },
    { name: "АО ОЭК", isInternal: false },
    { name: "ПАО Россети", isInternal: false },
  ];
  const ids: Record<string, string> = {};
  for (const { name, isInternal } of counterparties) {
    const record = await prisma.counterparty.upsert({
      where: { name },
      update: { isInternal },
      create: { name, isInternal },
    });
    ids[name] = record.id;
  }

  const outgoingDate = shift(-30);
  const outgoing = await prisma.letter.upsert({
    where: {
      projectId_number_direction_date: {
        projectId,
        number: "64-03-1001/26",
        direction: "OUTGOING",
        date: outgoingDate,
      },
    },
    update: {},
    create: {
      projectId,
      number: "64-03-1001/26",
      direction: "OUTGOING",
      date: outgoingDate,
      subject: "Направление регламента информационного взаимодействия на подписание",
      counterpartyId: ids["АО ОЭК"],
      ownerId,
      dueDate: shift(-10),
      status: "ANSWERED",
      closedAt: shift(-12),
      searchIndex: "64-03-1001/26 направление регламента информационного взаимодействия ао оэк",
    },
  });

  const incomingDate = shift(-6);
  await prisma.letter.upsert({
    where: {
      projectId_number_direction_date: {
        projectId,
        number: "64-01-2050/26",
        direction: "INCOMING",
        date: incomingDate,
      },
    },
    update: {},
    create: {
      projectId,
      number: "64-01-2050/26",
      direction: "INCOMING",
      date: incomingDate,
      subject: "О согласовании технического задания на распределительные сети",
      counterpartyId: ids["ДЖКХ"],
      ownerId: analystId,
      dueDate: shift(-1),
      status: "IN_PROGRESS",
      searchIndex: "64-01-2050/26 о согласовании технического задания джкх",
    },
  });

  const existing = await prisma.document.findFirst({
    where: { projectId, title: "Регламент — АО ОЭК" },
  });
  if (existing) return;

  await prisma.document.create({
    data: {
      projectId,
      kind: "REGULATION",
      title: "Регламент — АО ОЭК",
      counterpartyId: ids["АО ОЭК"],
      ownerId,
      status: "SIGNING",
      statusNote: "В наличии в 3 экземплярах",
      nextAction: "Передать подписанный экземпляр в ДЖКХ",
      dueDate: shift(20),
      outgoingLetterId: outgoing.id,
      signatures: {
        create: [
          {
            party: "ДИТ",
            counterpartyId: ids["ДИТ"],
            status: "SIGNED",
            signedAt: shift(-20),
            sortOrder: 0,
          },
          {
            party: "РСО",
            counterpartyId: ids["АО ОЭК"],
            status: "SIGNED",
            signedAt: shift(-8),
            sortOrder: 1,
          },
          { party: "ДЖКХ", counterpartyId: ids["ДЖКХ"], status: "PENDING", sortOrder: 2 },
        ],
      },
    },
  });
}

/**
 * Две встречи: прошедшая с решениями и предстоящая с повесткой. На демо без
 * них раздел «Встречи» выглядит пустым, хотя он в системе есть.
 */
async function seedMeetings(
  projectId: string,
  ownerId: string,
  participantIds: string[],
): Promise<void> {
  const MEETINGS = [
    {
      subject: "Статус внедрения: итоги месяца",
      kind: "STATUS",
      date: shift(-7),
      startTime: "10:00",
      endTime: "11:00",
      place: "Переговорная 4",
      agenda: "Готовность справочников. Сроки по интеграции. Открытые вопросы бухгалтерии.",
      decisions:
        "Справочник номенклатуры принять к 30-му. Интеграцию обсудить отдельной встречей с подрядчиком.",
    },
    {
      subject: "Техническая встреча по обмену данными",
      kind: "TECHNICAL",
      date: shift(4),
      startTime: "15:00",
      endTime: "16:30",
      place: "Видеовстреча",
      agenda: "Состав выгрузки, периодичность обмена, ответственные с обеих сторон.",
      decisions: null,
    },
  ];

  for (const meeting of MEETINGS) {
    const existing = await prisma.meeting.findFirst({
      where: { projectId, subject: meeting.subject },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.meeting.create({
      data: {
        ...meeting,
        projectId,
        ownerId,
        participants: {
          create: participantIds.map((memberId) => ({ memberId })),
        },
      },
    });
  }
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
