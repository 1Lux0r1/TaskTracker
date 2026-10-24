/**
 * Период плана работ: какой отрезок календаря показать на диаграмме и
 * выгрузить в Excel, и в каких колонках — неделях или месяцах. Экран и
 * выгрузка читают одни и те же параметры адреса, поэтому выгружается ровно
 * то, что видно.
 */
import { PLAN_CALENDAR, addDays, isoWeek, weekStart } from "./dates";

export type PlanScale = "week" | "month";

export const PLAN_PERIOD_PRESETS = [
  { value: "quarter", label: "Текущий квартал" },
  { value: "half", label: "Текущее полугодие" },
  { value: "year", label: "Текущий год" },
  { value: "all", label: "Весь план" },
  { value: "custom", label: "Свой период" },
] as const;

export type PlanPeriodPreset = (typeof PLAN_PERIOD_PRESETS)[number]["value"];

export const PLAN_SCALES = [
  { value: "week", label: "Недели" },
  { value: "month", label: "Месяцы" },
] as const;

export type PlanPeriod = {
  preset: PlanPeriodPreset;
  scale: PlanScale;
  /** Первый день периода. */
  from: Date;
  /** Последний день периода включительно. */
  to: Date;
};

export type PlanColumn = {
  start: Date;
  /** Последний день колонки включительно. */
  end: Date;
  /** Подпись колонки: номер недели или месяц. */
  label: string;
  /** Подпись группы над колонками: месяц с годом для недель, год для месяцев. */
  group: string;
};

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function monthLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Значение для поля type="month": 2026-03. */
export function toMonthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(value: string | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Number(match[1]), month - 1, 1);
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function clampToCalendar(date: Date): Date {
  if (date < PLAN_CALENDAR.from) return PLAN_CALENDAR.from;
  if (date > PLAN_CALENDAR.to) return PLAN_CALENDAR.to;
  return date;
}

/**
 * Период из параметров адреса: period, from, to (месяцы 2026-03), scale.
 * Заданные месяцы — это «свой период»; без них — выбранная заготовка, по
 * умолчанию текущий год. «Весь план» тянется от самой ранней задачи до
 * самой поздней, а без задач — на весь календарь.
 */
export function parsePlanPeriod(
  params: { period?: string; from?: string; to?: string; scale?: string },
  today: Date,
  planSpan: { from: Date; to: Date } | null = null,
): PlanPeriod {
  const scale: PlanScale = params.scale === "month" ? "month" : "week";
  const fromMonth = parseMonth(params.from);
  const toMonth = parseMonth(params.to);
  const asked = PLAN_PERIOD_PRESETS.find((item) => item.value === params.period)?.value;

  let preset: PlanPeriodPreset = asked ?? (fromMonth || toMonth ? "custom" : "year");
  let from: Date;
  let to: Date;

  const year = today.getFullYear();
  switch (preset) {
    case "quarter": {
      const first = Math.floor(today.getMonth() / 3) * 3;
      from = new Date(year, first, 1);
      to = monthEnd(new Date(year, first + 2, 1));
      break;
    }
    case "half": {
      const first = today.getMonth() < 6 ? 0 : 6;
      from = new Date(year, first, 1);
      to = monthEnd(new Date(year, first + 5, 1));
      break;
    }
    case "all":
      from = planSpan ? new Date(planSpan.from.getFullYear(), planSpan.from.getMonth(), 1) : PLAN_CALENDAR.from;
      to = planSpan ? monthEnd(planSpan.to) : PLAN_CALENDAR.to;
      break;
    case "custom":
      if (fromMonth || toMonth) {
        from = fromMonth ?? new Date((toMonth ?? today).getFullYear(), 0, 1);
        to = toMonth ? monthEnd(toMonth) : monthEnd(new Date(from.getFullYear(), 11, 1));
        break;
      }
      preset = "year";
      from = new Date(year, 0, 1);
      to = new Date(year, 11, 31);
      break;
    default:
      from = new Date(year, 0, 1);
      to = new Date(year, 11, 31);
  }

  // Перепутанные месяцы меняются местами: так понятнее, чем пустой план.
  if (to < from) [from, to] = [new Date(to.getFullYear(), to.getMonth(), 1), monthEnd(from)];
  return { preset, scale, from: clampToCalendar(from), to: clampToCalendar(to) };
}

/** Колонки диаграммы и выгрузки: недели с понедельника или календарные месяцы. */
export function planColumns(period: PlanPeriod): PlanColumn[] {
  const columns: PlanColumn[] = [];
  if (period.scale === "month") {
    for (
      let cursor = new Date(period.from.getFullYear(), period.from.getMonth(), 1);
      cursor <= period.to;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    ) {
      columns.push({
        start: cursor,
        end: monthEnd(cursor),
        label: MONTHS[cursor.getMonth()],
        group: String(cursor.getFullYear()),
      });
    }
    return columns;
  }
  for (let cursor = weekStart(period.from); cursor <= period.to; cursor = addDays(cursor, 7)) {
    // Месяц недели — по её четвергу, как и номер недели по ISO.
    const thursday = addDays(cursor, 3);
    columns.push({
      start: cursor,
      end: addDays(cursor, 6),
      label: String(isoWeek(cursor).week),
      group: monthLabel(thursday),
    });
  }
  return columns;
}

/** Попадает ли задача в период: хотя бы один её день внутри. */
export function overlapsPeriod(
  task: { startDate: Date | null; finishDate: Date | null },
  period: { from: Date; to: Date },
): boolean {
  if (!task.startDate || !task.finishDate) return false;
  return task.startDate <= period.to && task.finishDate >= period.from;
}

/**
 * Колонки, которые занимает отрезок, — первая и последняя, обрезанные краями
 * периода. null — отрезок целиком вне периода.
 */
export function columnSpan(
  columns: PlanColumn[],
  start: Date,
  finish: Date,
): { first: number; last: number } | null {
  let first = -1;
  let last = -1;
  columns.forEach((column, index) => {
    if (column.start <= finish && column.end >= start) {
      if (first < 0) first = index;
      last = index;
    }
  });
  return first < 0 ? null : { first, last };
}

/** Индекс колонки, в которую попадает дата, или -1. */
export function columnOf(columns: PlanColumn[], date: Date): number {
  return columns.findIndex((column) => column.start <= date && column.end >= date);
}

/** Подпись периода для заголовков: «янв 2026 – дек 2026, по неделям». */
export function periodLabel(period: PlanPeriod): string {
  const from = monthLabel(period.from);
  const to = monthLabel(period.to);
  return `${from === to ? from : `${from} – ${to}`}, ${period.scale === "month" ? "по месяцам" : "по неделям"}`;
}

/** Параметры адреса периода — для ссылок выгрузки и переключателя системы. */
export function periodSearch(period: PlanPeriod): Record<string, string> {
  return period.preset === "custom"
    ? { period: "custom", from: toMonthValue(period.from), to: toMonthValue(period.to), scale: period.scale }
    : { period: period.preset, scale: period.scale };
}
