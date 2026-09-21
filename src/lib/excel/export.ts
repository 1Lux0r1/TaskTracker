import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { TASK_COLUMNS } from "@/lib/excel/columns";
import { taskPriorityLabel, taskStatusLabel } from "@/lib/domain";

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
