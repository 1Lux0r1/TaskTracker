/**
 * Демонстрационные данные: два проекта, команда, задачи по всем трекам,
 * переписка цепочкой, документы с матрицей подписания (включая отказ),
 * график интеграций, отчёты руководству и встречи.
 *
 * Запуск: npm run db:seed. Скрипт идемпотентен: записи ищутся по признакам,
 * которые не зависят от дня прогона (номер письма, название задачи, этап
 * организации), иначе завтрашний прогон завёл бы вторые экземпляры тех же
 * записей — даты в демо отсчитываются от сегодняшнего дня.
 */
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { type Prisma, PrismaClient } from "../src/generated/prisma/client";

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
// Отсчёт от полуночи, а не от текущего момента: иначе ключ «номер + дата»
// письма в каждом прогоне получался новый и сид плодил дубли.
const today = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
})();

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

  // Ключ трека → его id в проекте: задачи демо разложены по всем четырём
  // трекам, иначе доска выглядит так, будто трек в системе один.
  const tracksByProject = new Map<string, Record<string, string>>();
  for (const project of [erp, site]) {
    const byKey: Record<string, string> = {};
    for (const track of BASE_TRACKS) {
      const existing = await prisma.track.findFirst({
        where: { projectId: project.id, name: track.name },
      });
      const row = existing ?? (await prisma.track.create({ data: { projectId: project.id, ...track } }));
      byKey[track.key] = row.id;
    }
    tracksByProject.set(project.id, byKey);
  }

  const tasks = [
    {
      projectId: erp.id,
      track: "PRODUCTION",
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
      track: "PRODUCTION",
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
      track: "PRODUCTION",
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
      track: "PRODUCTION",
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
      track: "INTERNAL",
      title: "Обучить пользователей",
      status: "BACKLOG",
      priority: "LOW",
      dueDate: shift(55),
      estimateHours: 16,
      progress: 0,
    },
    {
      projectId: erp.id,
      track: "LEGAL",
      title: "Согласовать регламент информационного взаимодействия с АО ОЭК",
      status: "DONE",
      priority: "HIGH",
      assigneeId: ivanov.id,
      externalAssignee: "Ежова О. В., АО ОЭК",
      startDate: shift(-30),
      dueDate: shift(-10),
      estimateHours: 12,
      spentHours: 14,
      progress: 100,
      progressNote: "Регламент подписан обеими сторонами, оригинал передан в дело.",
    },
    {
      projectId: erp.id,
      track: "LEGAL",
      title: "Отработать отказ ПАО Россети в подписании допсоглашения",
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      assigneeId: ivanov.id,
      externalAssignee: "Лапин С. Н., ПАО Россети",
      startDate: shift(-9),
      dueDate: shift(2),
      estimateHours: 8,
      spentHours: 3,
      progress: 30,
      progressNote: "Замечания получены письмом, готовим новую редакцию раздела о персональных данных.",
    },
    {
      projectId: erp.id,
      track: "EXTERNAL",
      title: "Открыть тестовую среду для ПАО МОЭК",
      status: "REVIEW",
      priority: "HIGH",
      assigneeId: sidorov.id,
      externalAssignee: "Дроздов А. И., ПАО МОЭК",
      dueDate: shift(-2),
      estimateHours: 20,
      spentHours: 18,
      progress: 85,
      progressNote: "Доступы выданы, ждём подтверждения от организации.",
    },
    {
      projectId: erp.id,
      track: "INTERNAL",
      title: "Подготовить отчёт руководству за две недели",
      status: "NEW",
      priority: "MEDIUM",
      assigneeId: kuznetsova.id,
      dueDate: shift(3),
      estimateHours: 4,
      progress: 0,
    },
    {
      projectId: site.id,
      track: "PRODUCTION",
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
      track: "PRODUCTION",
      title: "Подготовить дизайн-макеты",
      status: "TODO",
      priority: "HIGH",
      dueDate: shift(30),
      estimateHours: 60,
      progress: 0,
    },
  ];

  for (const [index, task] of tasks.entries()) {
    const { track, ...data } = task;
    const existing = await prisma.task.findFirst({
      where: { projectId: task.projectId, title: task.title },
    });
    if (existing) continue;

    await prisma.task.create({
      data: {
        ...data,
        trackId: tracksByProject.get(task.projectId)![track],
        number: await nextNumber(task.projectId),
        sortOrder: index + 1,
        completedAt: task.status === "DONE" ? shift(-25) : null,
      },
    });
  }

  await seedLegalTrack(erp.id, ivanov.id, petrova.id);
  await seedIntegrations(erp.id);
  await seedReports(erp.id, ivanov.id);
  await seedMeetings(erp.id, ivanov.id, [petrova.id, sidorov.id, kuznetsova.id]);

  console.log(
    [
      `проектов: ${await prisma.project.count()}`,
      `задач: ${await prisma.task.count()}`,
      `писем: ${await prisma.letter.count()}`,
      `документов: ${await prisma.document.count()}`,
      `организаций в графике: ${(await prisma.counterpartyMilestone.groupBy({ by: ["counterpartyId"] })).length}`,
      `отчётов: ${await prisma.weeklyReport.count()}`,
      `сотрудников: ${members.length}`,
    ].join(", "),
  );
}

/**
 * Юридический трек: переписка цепочкой «письмо — ответ» и два документа —
 * подписанный всеми сторонами и заблокированный отказом. На демо это главное,
 * чего нет в Excel: итоговый статус считается из матрицы сторон.
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
    { name: "ПАО МОЭК", isInternal: false },
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

  // Письмо ищем по номеру и направлению, а не по паре «номер + дата»: даты в
  // демо отсчитываются от сегодняшнего дня, и при завтрашнем прогоне ключ с
  // датой дал бы второй экземпляр того же письма.
  async function letter(
    number: string,
    direction: string,
    data: Omit<Prisma.LetterUncheckedCreateInput, "projectId" | "number" | "direction">,
  ): Promise<{ id: string }> {
    const existing = await prisma.letter.findFirst({
      where: { projectId, number, direction },
      select: { id: true },
    });
    if (existing) return existing;

    return prisma.letter.create({
      data: { projectId, number, direction, ...data },
      select: { id: true },
    });
  }

  const outgoing = await letter("64-03-1001/26", "OUTGOING", {
    date: shift(-30),
    subject: "Направление регламента информационного взаимодействия на подписание",
    counterpartyId: ids["АО ОЭК"],
    ownerId,
    signatory: "Иванов И. И., начальник управления",
    dueDate: shift(-10),
    status: "ANSWERED",
    responseRef: "вх. 64-01-1940/26 от " + formatRu(shift(-12)),
    closedAt: shift(-12),
    searchIndex: "64-03-1001/26 направление регламента информационного взаимодействия ао оэк",
  });

  // Ответ на исходящее: связь видна с обеих сторон карточки письма.
  await letter("64-01-1940/26", "INCOMING", {
    date: shift(-12),
    subject: "О подписании регламента информационного взаимодействия",
    counterpartyId: ids["АО ОЭК"],
    ownerId,
    responseToId: outgoing.id,
    resolution: "Иванову И. И. — приобщить подписанный экземпляр к делу.",
    status: "NOTED",
    closedAt: shift(-11),
    searchIndex: "64-01-1940/26 о подписании регламента информационного взаимодействия ао оэк",
  });

  await letter("64-01-2050/26", "INCOMING", {
    date: shift(-6),
    subject: "О согласовании технического задания на распределительные сети",
    counterpartyId: ids["ДЖКХ"],
    ownerId: analystId,
    resolution: "Петровой М. — подготовить ответ до конца недели.",
    dueDate: shift(-1),
    status: "IN_PROGRESS",
    searchIndex: "64-01-2050/26 о согласовании технического задания джкх",
  });

  const refusal = await letter("64-01-2101/26", "INCOMING", {
    date: shift(-4),
    subject: "О замечаниях к дополнительному соглашению по обработке данных",
    counterpartyId: ids["ПАО Россети"],
    ownerId,
    resolution: "Иванову И. И. — подготовить новую редакцию раздела о персональных данных.",
    dueDate: shift(2),
    status: "IN_PROGRESS",
    searchIndex:
      "64-01-2101/26 о замечаниях к дополнительному соглашению по обработке данных пао россети",
  });

  await document(projectId, "Регламент — АО ОЭК", {
    kind: "REGULATION",
    counterpartyId: ids["АО ОЭК"],
    ownerId,
    status: "SIGNING",
    statusNote: "В наличии в 3 экземплярах",
    nextAction: "Передать подписанный экземпляр в ДЖКХ",
    dueDate: shift(20),
    outgoingLetterId: outgoing.id,
    signatures: {
      create: [
        { party: "ДИТ", counterpartyId: ids["ДИТ"], status: "SIGNED", signedAt: shift(-20), sortOrder: 0 },
        { party: "РСО", counterpartyId: ids["АО ОЭК"], status: "SIGNED", signedAt: shift(-8), sortOrder: 1 },
        { party: "ДЖКХ", counterpartyId: ids["ДЖКХ"], status: "PENDING", sortOrder: 2 },
      ],
    },
  });

  // Отказ стороны — штатный исход: документ блокируется целиком, и по нему
  // видно, кто отказал и почему.
  await document(projectId, "ДС к NDA — ПАО Россети", {
    kind: "NDA_ADDENDUM",
    counterpartyId: ids["ПАО Россети"],
    ownerId,
    status: "DECLINED",
    statusNote: "Отказ: раздел об обработке персональных данных не согласован",
    nextAction: "Подготовить новую редакцию раздела 4 и направить повторно",
    dueDate: shift(2),
    signatures: {
      create: [
        { party: "ДИТ", counterpartyId: ids["ДИТ"], status: "SIGNED", signedAt: shift(-14), sortOrder: 0 },
        {
          party: "РСО",
          counterpartyId: ids["ПАО Россети"],
          status: "DECLINED",
          refusalReason:
            "Не согласован раздел 4: состав передаваемых персональных данных и срок их хранения.",
          respondedAt: shift(-4),
          basisLetterId: refusal.id,
          sortOrder: 1,
        },
        { party: "ДЖКХ", counterpartyId: ids["ДЖКХ"], status: "NOT_REQUIRED", sortOrder: 2 },
      ],
    },
  });
}

/** Документ ищем по названию: повторный прогон сида не плодит второй такой же. */
async function document(
  projectId: string,
  title: string,
  data: Omit<Prisma.DocumentUncheckedCreateInput, "projectId" | "title">,
): Promise<void> {
  const existing = await prisma.document.findFirst({ where: { projectId, title } });
  if (existing) return;

  await prisma.document.create({ data: { projectId, title, ...data } });
}

/** Дата в письме и отчёте пишется так же, как её читает человек. */
function formatRu(value: Date): string {
  return value.toLocaleDateString("ru-RU");
}

/**
 * График интеграций «организация × этап»: три организации на разных стадиях —
 * одна прошла весь путь, вторая идёт по плану, третья просрочила срок. Пустой
 * график («0 из 0») не показывает того, ради чего он сделан.
 */
async function seedIntegrations(projectId: string): Promise<void> {
  const PLAN: { name: string; stages: Record<string, [number | null, number | null]> }[] = [
    {
      name: "АО ОЭК",
      stages: {
        REGULATION_SENT: [-30, -30],
        REGULATION_SIGNED: [-12, -12],
        SYSTEM_READY: [-9, -8],
        DEV_INTEGRATION: [-5, -4],
        TEST_OPENED: [-1, -1],
      },
    },
    {
      name: "ПАО МОЭК",
      stages: {
        REGULATION_SENT: [-25, -24],
        REGULATION_SIGNED: [-7, -6],
        SYSTEM_READY: [-2, null],
        DEV_INTEGRATION: [9, null],
        TEST_OPENED: [20, null],
      },
    },
    {
      name: "ПАО Россети",
      stages: {
        REGULATION_SENT: [-18, -18],
        REGULATION_SIGNED: [4, null],
        SYSTEM_READY: [18, null],
        DEV_INTEGRATION: [32, null],
        TEST_OPENED: [45, null],
      },
    },
  ];

  // Порядок этапов тот же, что в справочнике: колонки графика идут по нему.
  const ORDER = [
    "REGULATION_SENT",
    "REGULATION_SIGNED",
    "SYSTEM_READY",
    "DEV_INTEGRATION",
    "TEST_OPENED",
  ];

  for (const row of PLAN) {
    const counterparty = await prisma.counterparty.findUnique({ where: { name: row.name } });
    if (!counterparty) continue;

    for (const [stage, [planned, actual]] of Object.entries(row.stages)) {
      await prisma.counterpartyMilestone.upsert({
        where: {
          projectId_counterpartyId_stage: { projectId, counterpartyId: counterparty.id, stage },
        },
        update: {},
        create: {
          projectId,
          counterpartyId: counterparty.id,
          stage,
          sortOrder: ORDER.indexOf(stage),
          plannedDate: planned === null ? null : shift(planned),
          actualDate: actual === null ? null : shift(actual),
        },
      });
    }
  }
}

/**
 * Два отчёта руководству: отправленный заморожен и правке не подлежит,
 * текущий ещё черновик. Без отправленного не видно, чем заморозка отличается.
 */
async function seedReports(projectId: string, authorId: string): Promise<void> {
  const REPORTS = [
    {
      periodStart: shift(-28),
      periodEnd: shift(-15),
      state: "SUBMITTED",
      submittedAt: shift(-14),
      releaseInfo: "Регламент с АО ОЭК подписан обеими сторонами",
      done: "Собраны требования бухгалтерии. Направлен и подписан регламент с АО ОЭК. Открыт обмен в dev-среде.",
      planned: "Справочник номенклатуры. Тестовая среда для ПАО МОЭК. Допсоглашение с ПАО Россети.",
      blockers: "ДЖКХ не вернул подписанный экземпляр регламента.",
      solutions: "Срок по ДЖКХ поставлен на контроль, направлено напоминание.",
    },
    {
      periodStart: shift(-14),
      periodEnd: shift(-1),
      state: "DRAFT",
      submittedAt: null,
      releaseInfo: null,
      done: "Открыта тестовая среда для ПАО МОЭК. Получены замечания ПАО Россети к допсоглашению.",
      planned: "Новая редакция раздела о персональных данных. Выгрузка проводок.",
      blockers: "ПАО Россети отказало в подписании допсоглашения.",
      solutions: null,
    },
  ];

  // Ищем по состоянию, а не по периоду: период отсчитывается от сегодняшнего
  // дня, и завтра тот же отчёт получил бы другие границы и лёг бы вторым.
  for (const report of REPORTS) {
    const existing = await prisma.weeklyReport.findFirst({
      where: { projectId, state: report.state },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.weeklyReport.create({ data: { projectId, authorId, ...report } });
  }
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
