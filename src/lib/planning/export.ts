/**
 * Выгрузка плана работ в Excel за выбранный период. Лист повторяет «План
 * работ» книги заказчика: код пункта (ДК), код МС с этапом, шифр,
 * наименование, статус и срок пункта, сроки задачи и шкала по неделям или месяцам с закрашенными
 * клетками. Второй лист — параметры выгрузки и легенда цветов.
 */
import ExcelJS from "exceljs";
import { formatDate, planDkStatus } from "../domain";
import { type PlanPeriod, columnSpan, periodLabel, planColumns } from "./period";
import { type PlanViewBlock, dkSpan, taskTone } from "./plan-view";

/** Цвета клеток шкалы — те же, что на экране. */
const FILLS = {
  dk: "FF9333EA",
  ms: "FF3B82F6",
  repeat: "FFEF4444",
  span: "FFBAE6FD",
  block: "FFF3F4F6",
  header: "FF1F2937",
  today: "FFF59E0B",
} as const;

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Колонки до шкалы. */
const FIXED = [
  { header: "Код Бизнес", width: 20 },
  { header: "Код МС", width: 14 },
  { header: "Шифр", width: 30 },
  { header: "Наименование", width: 52 },
  { header: "Статус", width: 22 },
  { header: "Срок", width: 11 },
  { header: "Старт", width: 11 },
  { header: "Финиш", width: 11 },
  { header: "Недель", width: 8 },
] as const;

export type PlanExportInput = {
  system: { code: string; name: string };
  period: PlanPeriod;
  query: string;
  blocks: PlanViewBlock[];
  today: Date;
  /** Кто выгрузил: имя пользователя. */
  author?: string | null;
};

/** Код МС с этапом, как в колонке «Код МС» книги: TA.1.Р2 или БА у пункта. */
function msCode(cipher: string, dkCode: string): string {
  return cipher.startsWith(`${dkCode}.`) ? cipher.slice(dkCode.length + 1) : cipher;
}

export function buildPlanWorkbook(input: PlanExportInput): ExcelJS.Workbook {
  const { system, period, query, blocks, today } = input;
  const columns = planColumns(period);
  const first = FIXED.length + 1;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TaskTracker";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("План работ", {
    views: [{ state: "frozen", xSplit: 4, ySplit: 3 }],
    properties: { defaultRowHeight: 16 },
  });
  sheet.columns = [
    ...FIXED.map((column) => ({ width: column.width })),
    ...columns.map(() => ({ width: period.scale === "month" ? 6 : 3.2 })),
  ];

  // Строка 1 — заголовок, строка 2 — группы шкалы, строка 3 — подписи колонок.
  sheet.getCell(1, 1).value = `План работ · ${system.code} ${system.name} · ${periodLabel(period)}`;
  sheet.getCell(1, 1).font = { bold: true, size: 13 };

  const groupRow = sheet.getRow(2);
  const headerRow = sheet.getRow(3);
  FIXED.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.header;
  });
  let groupStart = 0;
  columns.forEach((column, index) => {
    headerRow.getCell(first + index).value = column.label;
    const last = index === columns.length - 1 || columns[index + 1].group !== column.group;
    if (last) {
      groupRow.getCell(first + groupStart).value = column.group;
      if (index > groupStart) sheet.mergeCells(2, first + groupStart, 2, first + index);
      groupStart = index + 1;
    }
  });
  for (const row of [groupRow, headerRow]) {
    for (let c = 1; c < first + columns.length; c += 1) {
      const cell = row.getCell(c);
      cell.fill = fill(FILLS.header);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.alignment = { vertical: "middle", horizontal: c >= first ? "center" : "left" };
    }
  }

  const todayColumn = columns.findIndex((column) => column.start <= today && column.end >= today);
  const paint = (row: ExcelJS.Row, from: Date | null, to: Date | null, argb: string) => {
    if (!from || !to) return;
    const span = columnSpan(columns, from, to);
    if (!span) return;
    for (let c = span.first; c <= span.last; c += 1) row.getCell(first + c).fill = fill(argb);
  };
  const markToday = (row: ExcelJS.Row) => {
    if (todayColumn < 0) return;
    const cell = row.getCell(first + todayColumn);
    cell.border = { left: { style: "thin", color: { argb: FILLS.today } } };
  };

  let tasks = 0;
  for (const block of blocks) {
    const row = sheet.addRow([block.code, null, null, `${block.direction.name} · ${block.part.name}`]);
    row.font = { bold: true };
    for (let c = 1; c < first + columns.length; c += 1) row.getCell(c).fill = fill(FILLS.block);

    for (const { dk, code, tasks: list } of block.dks) {
      const span = dkSpan(dk.tasks);
      const dkRow = sheet.addRow([
        code,
        null,
        null,
        dk.name,
        planDkStatus(dk.status).label,
        dk.deadline,
        span?.from ?? null,
        span?.to ?? null,
        null,
      ]);
      dkRow.font = { bold: true };
      paint(dkRow, span?.from ?? null, span?.to ?? null, FILLS.span);
      markToday(dkRow);

      for (const task of list) {
        tasks += 1;
        const taskRow = sheet.addRow([
          code,
          msCode(task.cipher, code),
          task.cipher,
          task.name,
          null,
          null,
          task.startDate,
          task.finishDate,
          task.durationWeeks,
        ]);
        paint(taskRow, task.startDate, task.finishDate, FILLS[taskTone(task)]);
        markToday(taskRow);
      }
    }
  }

  for (const column of [6, 7, 8]) sheet.getColumn(column).numFmt = "dd.mm.yyyy";
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: FIXED.length } };

  const about = workbook.addWorksheet("Параметры");
  about.columns = [{ width: 24 }, { width: 60 }];
  const rows: [string, string][] = [
    ["Система", `${system.code} · ${system.name}`],
    ["Период", periodLabel(period)],
    ["С", formatDate(period.from)],
    ["По", formatDate(period.to)],
    ["Поиск", query || "—"],
    ["Задач", String(tasks)],
    ["Выгружено", `${formatDate(new Date())}${input.author ? `, ${input.author}` : ""}`],
  ];
  for (const [label, value] of rows) about.addRow([label, value]).getCell(1).font = { bold: true };
  about.addRow([]);
  about.addRow(["Легенда"]).getCell(1).font = { bold: true };
  const legend: [string, string][] = [
    [FILLS.dk, "задача по пункту дорожной карты: ОА, БА, Арх"],
    [FILLS.ms, "задача по МС"],
    [FILLS.repeat, "повтор (возврат): Р2, Т2"],
    [FILLS.span, "срок ДК: от первой задачи до последней"],
  ];
  for (const [argb, label] of legend) {
    const row = about.addRow([null, label]);
    row.getCell(1).fill = fill(argb);
  }
  about.addRow([]);
  about.addRow([
    "Примечание",
    "Задачи без сроков выгружаются без закраски. Задача, задевающая период хотя бы одним днём, попадает в выгрузку целиком, а закраска обрезается краями периода.",
  ]).getCell(2).alignment = { wrapText: true };

  return workbook;
}
