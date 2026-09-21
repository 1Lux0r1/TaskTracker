import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { TASK_COLUMNS } from "@/lib/excel/columns";
import {
  documentKindLabel,
  documentStatusLabel,
  formatPeriod,
  letterDirectionLabel,
  letterStatusLabel,
  signatureStatusLabel,
  taskPriorityLabel,
  taskStatusLabel,
  taskTrackLabel,
} from "@/lib/domain";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};

/** Выгрузка задач в .xlsx. Без projectId выгружаются все проекты. */
export async function buildTasksWorkbook(projectId?: string): Promise<ExcelJS.Workbook> {
  const tasks = await prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    include: { assignee: true, project: true },
    orderBy: [{ project: { code: "asc" } }, { number: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TaskTracker";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Задачи", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const columns: ExcelJS.Column[] = [];
  if (!projectId) {
    columns.push({ key: "project", header: "Проект", width: 18 } as ExcelJS.Column);
  }
  columns.push({ key: "track", header: "Трек", width: 18 } as ExcelJS.Column);
  for (const column of TASK_COLUMNS) {
    columns.push({ key: column.key, header: column.header, width: column.width } as ExcelJS.Column);
  }
  sheet.columns = columns;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: "middle" };

  for (const task of tasks) {
    sheet.addRow({
      project: task.project.code,
      track: taskTrackLabel(task.track),
      externalKey: task.externalKey ?? `${task.project.code}-${task.number}`,
      title: task.title,
      description: task.description ?? "",
      status: taskStatusLabel(task.status),
      priority: taskPriorityLabel(task.priority),
      assignee: task.assignee?.fullName ?? "",
      startDate: task.startDate ?? "",
      dueDate: task.dueDate ?? "",
      estimateHours: task.estimateHours ?? "",
      spentHours: task.spentHours ?? "",
      progress: task.progress,
    });
  }

  for (const key of ["startDate", "dueDate"]) {
    const column = sheet.getColumn(key);
    if (column) column.numFmt = "dd.mm.yyyy";
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };

  return workbook;
}

/** Пустой файл-образец с правильными заголовками и одной строкой-примером. */
export function buildImportTemplate(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TaskTracker";

  const sheet = workbook.addWorksheet("Задачи");
  sheet.columns = TASK_COLUMNS.map(
    (column) => ({ key: column.key, header: column.header, width: column.width }) as ExcelJS.Column,
  );

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = HEADER_FILL;

  sheet.addRow({
    externalKey: "1",
    title: "Согласовать техническое задание",
    description: "Собрать замечания у заказчика и зафиксировать объём работ",
    status: "В работе",
    priority: "Высокий",
    assignee: "Иванов Иван",
    startDate: new Date(),
    dueDate: new Date(Date.now() + 7 * 86_400_000),
    estimateHours: 16,
    spentHours: 4,
    progress: 25,
  });

  for (const key of ["startDate", "dueDate"]) {
    sheet.getColumn(key).numFmt = "dd.mm.yyyy";
  }

  return workbook;
}


/** Стиль шапки общий для всех выгрузок. */
function styleHeader(sheet: ExcelJS.Worksheet): void {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

/** Выгрузка переписки ЭДО в том же виде, в каком её ведут в реестре. */
export async function buildLettersWorkbook(projectId?: string): Promise<ExcelJS.Workbook> {
  const letters = await prisma.letter.findMany({
    where: projectId ? { projectId } : undefined,
    include: { counterparty: true, owner: true, project: true },
    orderBy: [{ date: "desc" }],
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TaskTracker";
  const sheet = workbook.addWorksheet("Письма ЭДО");

  sheet.columns = [
    { key: "project", header: "Проект", width: 12 },
    { key: "number", header: "Номер письма", width: 22 },
    { key: "date", header: "Дата письма", width: 14 },
    { key: "subject", header: "Тема", width: 60 },
    { key: "url", header: "Ссылка на письмо", width: 40 },
    { key: "direction", header: "Тип", width: 14 },
    { key: "counterparty", header: "Контрагент", width: 28 },
    { key: "dueDate", header: "Срок исполнения", width: 16 },
    { key: "overdue", header: "Просрочка", width: 14 },
    { key: "responseRef", header: "Ответ реквизиты", width: 28 },
    { key: "status", header: "Статус", width: 20 },
    { key: "statusNote", header: "Уточнение", width: 30 },
    { key: "externalTaskKey", header: "Задача в трекере", width: 24 },
    { key: "owner", header: "Ответственный", width: 24 },
    { key: "comment", header: "Комментарий", width: 40 },
  ] as ExcelJS.Column[];

  const today = new Date();
  for (const letter of letters) {
    const overdue =
      letter.dueDate && letter.closedAt === null && letter.dueDate < today
        ? `просрочка ${Math.ceil((today.getTime() - letter.dueDate.getTime()) / 86_400_000)} дн.`
        : letter.closedAt
          ? "исполнено"
          : "";

    sheet.addRow({
      project: letter.project.code,
      number: letter.number,
      date: letter.date ?? "",
      subject: letter.subject,
      url: letter.url ?? "",
      direction: letterDirectionLabel(letter.direction),
      counterparty: letter.counterparty?.name ?? "",
      dueDate: letter.dueDate ?? "",
      overdue,
      responseRef: letter.responseRef ?? "",
      status: letterStatusLabel(letter.status),
      statusNote: letter.statusNote ?? "",
      externalTaskKey: letter.externalTaskKey ?? "",
      owner: letter.owner?.fullName ?? "",
      comment: letter.comment ?? "",
    });
  }

  for (const key of ["date", "dueDate"]) sheet.getColumn(key).numFmt = "dd.mm.yyyy";
  styleHeader(sheet);
  return workbook;
}

/**
 * Выгрузка документов: лист с самими документами и лист с подписями сторон.
 * Матрицу подписания в одну строку не уложить, поэтому стороны идут отдельно.
 */
export async function buildDocumentsWorkbook(projectId?: string): Promise<ExcelJS.Workbook> {
  const documents = await prisma.document.findMany({
    where: projectId ? { projectId } : undefined,
    include: {
      counterparty: true,
      owner: true,
      project: true,
      signatures: { include: { counterparty: true }, orderBy: { sortOrder: "asc" } },
      outgoingLetter: true,
      incomingLetter: true,
    },
    orderBy: [{ kind: "asc" }, { title: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TaskTracker";

  const sheet = workbook.addWorksheet("Документы");
  sheet.columns = [
    { key: "project", header: "Проект", width: 12 },
    { key: "kind", header: "Вид", width: 18 },
    { key: "title", header: "Документ", width: 50 },
    { key: "counterparty", header: "Контрагент", width: 28 },
    { key: "status", header: "Итоговый статус", width: 22 },
    { key: "statusNote", header: "Уточнение", width: 34 },
    { key: "signed", header: "Подписано сторон", width: 18 },
    { key: "dueDate", header: "Срок", width: 14 },
    { key: "signedAt", header: "Дата подписания", width: 16 },
    { key: "owner", header: "Ответственный", width: 24 },
    { key: "nextAction", header: "Актуальные задачи", width: 40 },
    { key: "outgoing", header: "Письмо из ДИТ", width: 24 },
    { key: "incoming", header: "Письмо с ответом", width: 24 },
  ] as ExcelJS.Column[];

  for (const document of documents) {
    const required = document.signatures.filter((item) => item.status !== "NOT_REQUIRED");
    const signed = required.filter((item) => item.status === "SIGNED").length;
    sheet.addRow({
      project: document.project.code,
      kind: documentKindLabel(document.kind),
      title: document.title,
      counterparty: document.counterparty?.name ?? "",
      status: documentStatusLabel(document.status),
      statusNote: document.statusNote ?? "",
      signed: required.length === 0 ? "" : `${signed} из ${required.length}`,
      dueDate: document.dueDate ?? "",
      signedAt: document.signedAt ?? "",
      owner: document.owner?.fullName ?? "",
      nextAction: document.nextAction ?? "",
      outgoing: document.outgoingLetter?.number ?? "",
      incoming: document.incomingLetter?.number ?? "",
    });
  }
  for (const key of ["dueDate", "signedAt"]) sheet.getColumn(key).numFmt = "dd.mm.yyyy";
  styleHeader(sheet);

  const parties = workbook.addWorksheet("Стороны подписания");
  parties.columns = [
    { key: "document", header: "Документ", width: 50 },
    { key: "party", header: "Сторона", width: 28 },
    { key: "status", header: "Статус", width: 18 },
    { key: "signedAt", header: "Дата подписания", width: 16 },
    { key: "refusalReason", header: "Причина отказа", width: 44 },
    { key: "note", header: "Комментарий", width: 34 },
  ] as ExcelJS.Column[];

  for (const document of documents) {
    for (const signature of document.signatures) {
      parties.addRow({
        document: document.title,
        party: signature.counterparty?.name ?? signature.party,
        status: signatureStatusLabel(signature.status),
        signedAt: signature.signedAt ?? "",
        refusalReason: signature.refusalReason ?? "",
        note: signature.note ?? "",
      });
    }
  }
  parties.getColumn("signedAt").numFmt = "dd.mm.yyyy";
  styleHeader(parties);

  return workbook;
}

/** Отчёт руководству в том виде, в каком его отправляют: разделами, а не таблицей. */
export async function buildReportWorkbook(reportId: string): Promise<ExcelJS.Workbook | null> {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    include: { project: { include: { owner: true } }, author: true },
  });
  if (!report) return null;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TaskTracker";
  const sheet = workbook.addWorksheet("Отчёт");

  sheet.columns = [
    { key: "field", header: "Раздел", width: 38 },
    { key: "value", header: "Содержание", width: 120 },
  ] as ExcelJS.Column[];

  const rows: [string, string][] = [
    ["Название проекта", report.project.name],
    ["Руководитель проекта", report.project.owner?.fullName ?? ""],
    ["Период", formatPeriod(report.periodStart, report.periodEnd)],
    ["Релиз (тема, дата)", report.releaseInfo ?? ""],
    ["Выполненные работы за период", report.done ?? ""],
    ["Запланированные работы на следующий период", report.planned ?? ""],
    ["Текущие блокеры", report.blockers ?? ""],
    ["Предлагаемые решения", report.solutions ?? ""],
    ["Ответственный за заполнение", report.author?.fullName ?? ""],
  ];

  for (const [field, value] of rows) {
    const row = sheet.addRow({ field, value });
    row.alignment = { vertical: "top", wrapText: true };
  }

  styleHeader(sheet);
  sheet.autoFilter = undefined as unknown as ExcelJS.AutoFilter;
  return workbook;
}
