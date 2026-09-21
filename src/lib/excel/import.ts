import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { isSummaryTitle, matchColumns, parsePriority, parseStatus } from "@/lib/excel/columns";
import { cellDate, cellNumber, cellText } from "@/lib/excel/parse-cell";

export type ImportRowError = { row: number; message: string };

export type ImportReport = {
  fileName: string;
  sheetName: string | null;
  headerRow: number | null;
  recognizedColumns: string[];
  rowsTotal: number;
  created: number;
  updated: number;
  skipped: number;
  membersCreated: string[];
  errors: ImportRowError[];
};

export type ImportOptions = {
  /** Проект, в который загружаются строки. */
  projectId: string;
  /** Создавать сотрудников, которых нет в справочнике. */
  createMissingMembers: boolean;
  /** Показать разбор без записи в базу. */
  dryRun: boolean;
};

/** Сколько первых строк просматриваем в поисках шапки таблицы. */
const HEADER_SEARCH_DEPTH = 10;

type ParsedRow = {
  rowNumber: number;
  externalKey: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  assignee: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  estimateHours: number | null;
  spentHours: number | null;
  progress: number | null;
};

export async function importTasksFromXlsx(
  buffer: ArrayBuffer,
  fileName: string,
  options: ImportOptions,
): Promise<ImportReport> {
  const report: ImportReport = {
    fileName,
    sheetName: null,
    headerRow: null,
    recognizedColumns: [],
    rowsTotal: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    membersCreated: [],
    errors: [],
  };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets.find((candidate) => candidate.rowCount > 0);
  if (!sheet) {
    report.errors.push({ row: 0, message: "В файле нет ни одного листа с данными" });
    return report;
  }
  report.sheetName = sheet.name;

  const header = findHeader(sheet);
  if (!header) {
    report.errors.push({
      row: 0,
      message:
        "Не удалось найти шапку таблицы. Нужна строка с колонками «Задача» и хотя бы одной из: Статус, Ответственный, Срок",
    });
    return report;
  }

  report.headerRow = header.rowNumber;
  report.recognizedColumns = [...header.columns.values()];

  const rows = readRows(sheet, header);
  report.rowsTotal = rows.length;

  if (options.dryRun) {
    report.skipped = rows.length;
    return report;
  }

  const members = await loadMemberIndex();
  const existing = await prisma.task.findMany({
    where: { projectId: options.projectId },
    select: { id: true, externalKey: true, title: true },
  });
  const byExternalKey = new Map(
    existing.filter((task) => task.externalKey).map((task) => [task.externalKey!, task.id]),
  );
  const byTitle = new Map(existing.map((task) => [task.title.toLowerCase(), task.id]));

  let nextNumber = await nextTaskNumber(options.projectId);

  for (const row of rows) {
    try {
      let assigneeId: string | null = null;
      if (row.assignee) {
        const key = row.assignee.toLowerCase();
        assigneeId = members.get(key) ?? null;
        if (!assigneeId && options.createMissingMembers) {
          const member = await prisma.member.create({ data: { fullName: row.assignee } });
          members.set(key, member.id);
          assigneeId = member.id;
          report.membersCreated.push(row.assignee);
        }
      }

      const data = {
        title: row.title,
        description: row.description,
        status: row.status ?? "TODO",
        priority: row.priority ?? "MEDIUM",
        assigneeId,
        startDate: row.startDate,
        dueDate: row.dueDate,
        estimateHours: row.estimateHours,
        spentHours: row.spentHours,
        progress: clampProgress(row.progress),
        completedAt: row.status === "DONE" ? new Date() : null,
      };

      const existingId =
        (row.externalKey ? byExternalKey.get(row.externalKey) : undefined) ??
        byTitle.get(row.title.toLowerCase());

      if (existingId) {
        await prisma.task.update({ where: { id: existingId }, data });
        report.updated += 1;
      } else {
        const created = await prisma.task.create({
          data: {
            ...data,
            projectId: options.projectId,
            number: nextNumber,
            sortOrder: nextNumber,
            externalKey: row.externalKey,
          },
        });
        byTitle.set(created.title.toLowerCase(), created.id);
        if (created.externalKey) byExternalKey.set(created.externalKey, created.id);
        nextNumber += 1;
        report.created += 1;
      }
    } catch (error) {
      report.skipped += 1;
      report.errors.push({
        row: row.rowNumber,
        message: error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    }
  }

  await prisma.importBatch.create({
    data: {
      fileName,
      projectId: options.projectId,
      rowsTotal: report.rowsTotal,
      rowsCreated: report.created,
      rowsUpdated: report.updated,
      rowsSkipped: report.skipped,
      errorsJson: report.errors.length > 0 ? JSON.stringify(report.errors) : null,
    },
  });

  return report;
}

type Header = { rowNumber: number; columns: Map<number, string> };

/**
 * Шапка не всегда в первой строке: над таблицей часто стоят заголовок и логотип.
 * Берём первую строку, где есть «Задача» и ещё одна осмысленная колонка.
 */
function findHeader(sheet: ExcelJS.Worksheet): Header | null {
  const depth = Math.min(HEADER_SEARCH_DEPTH, sheet.rowCount);
  for (let rowNumber = 1; rowNumber <= depth; rowNumber += 1) {
    const values = rowValues(sheet.getRow(rowNumber));
    const columns = matchColumns(values);
    const keys = new Set(columns.values());
    if (keys.has("title") && keys.size >= 2) {
      return { rowNumber, columns };
    }
  }
  return null;
}

function rowValues(row: ExcelJS.Row): unknown[] {
  const values = row.values;
  if (!Array.isArray(values)) return [];
  // ExcelJS нумерует колонки с единицы и держит values[0] пустым.
  return values.slice(1);
}

function readRows(sheet: ExcelJS.Worksheet, header: Header): ParsedRow[] {
  const rows: ParsedRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;

    const cells = new Map<string, ExcelJS.CellValue>();
    header.columns.forEach((key, index) => {
      cells.set(key, row.getCell(index + 1).value);
    });

    const title = cellText(cells.get("title") ?? null);
    if (!title || isSummaryTitle(title)) return;

    rows.push({
      rowNumber,
      externalKey: cellText(cells.get("externalKey") ?? null),
      title,
      description: cellText(cells.get("description") ?? null),
      status: parseStatus(cellText(cells.get("status") ?? null)),
      priority: parsePriority(cellText(cells.get("priority") ?? null)),
      assignee: cellText(cells.get("assignee") ?? null),
      startDate: cellDate(cells.get("startDate") ?? null),
      dueDate: cellDate(cells.get("dueDate") ?? null),
      estimateHours: cellNumber(cells.get("estimateHours") ?? null),
      spentHours: cellNumber(cells.get("spentHours") ?? null),
      progress: cellNumber(cells.get("progress") ?? null),
    });
  });

  return rows;
}

async function loadMemberIndex(): Promise<Map<string, string>> {
  const members = await prisma.member.findMany({ select: { id: true, fullName: true } });
  return new Map(members.map((member) => [member.fullName.toLowerCase(), member.id]));
}

async function nextTaskNumber(projectId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

/** В Excel проценты хранятся долей единицы, поэтому 0.35 — это 35 %. */
function clampProgress(value: number | null): number {
  if (value === null) return 0;
  const percent = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(percent)));
}
