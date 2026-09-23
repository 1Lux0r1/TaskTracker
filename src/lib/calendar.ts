/**
 * Календарь: разбор параметров адреса, границы периода и сетка дней.
 *
 * Всё, что можно посчитать без базы, живёт здесь — страница остаётся
 * про отрисовку, а правила периодов проверяются тестами.
 */

export const CALENDAR_VIEWS = [
  { value: "month", label: "Месяц" },
  { value: "week", label: "Неделя" },
  { value: "list", label: "Список" },
] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number]["value"];

/** Типы записей, которые календарь показывает; каждый включается отдельно. */
export const CALENDAR_TYPES = [
  { value: "task", label: "Задачи" },
  { value: "letter", label: "Письма" },
  { value: "document", label: "Документы" },
  { value: "meeting", label: "Встречи" },
] as const;

export type CalendarType = (typeof CALENDAR_TYPES)[number]["value"];

export const ALL_CALENDAR_TYPES: CalendarType[] = CALENDAR_TYPES.map((item) => item.value);

export type CalendarFilter = {
  view: CalendarView;
  /** Выбранный день: он же точка отсчёта периода и день боковой панели. */
  day: Date;
  projectId: string;
  types: CalendarType[];
  /** Полосы «от постановки до срока» в месяце — по умолчанию выключены. */
  showDuration: boolean;
};

type SearchParams = Record<string, string | string[] | undefined>;

export function readCalendarFilter(params: SearchParams, today: Date): CalendarFilter {
  const view = single(params.view);
  const types = (single(params.types) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is CalendarType => ALL_CALENDAR_TYPES.includes(value as CalendarType));

  return {
    view: CALENDAR_VIEWS.some((item) => item.value === view) ? (view as CalendarView) : "month",
    day: parseDay(single(params.day), today),
    projectId: single(params.projectId) ?? "",
    // Пустой список значит «ничего не выбрано» только если параметр был задан:
    // иначе календарь открывался бы чистым.
    types: params.types === undefined ? ALL_CALENDAR_TYPES : types,
    showDuration: single(params.duration) === "1",
  };
}

/** Границы периода: месяц целиком, неделя с понедельника, список — тот же месяц. */
export function calendarRange(view: CalendarView, day: Date): { start: Date; end: Date } {
  if (view === "week") {
    const start = startOfWeek(day);
    return { start, end: endOfDay(addDays(start, 6)) };
  }
  const start = new Date(day.getFullYear(), day.getMonth(), 1);
  const end = new Date(day.getFullYear(), day.getMonth() + 1, 0);
  return { start, end: endOfDay(end) };
}

/** Сетка месяца с понедельника: целые недели, дни соседних месяцев тоже попадают. */
export function buildMonthGrid(day: Date): Date[] {
  const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);
  const monthEnd = new Date(day.getFullYear(), day.getMonth() + 1, 0);
  const first = startOfWeek(monthStart);
  const last = addDays(startOfWeek(monthEnd), 6);

  const cells: Date[] = [];
  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) cells.push(cursor);
  return cells;
}

export function buildWeekDays(day: Date): Date[] {
  const start = startOfWeek(day);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** Шаг «назад-вперёд»: месяц в месячном и списочном виде, неделя в недельном. */
export function shiftCalendar(view: CalendarView, day: Date, delta: number): Date {
  if (view === "week") return addDays(day, delta * 7);
  const shifted = new Date(day.getFullYear(), day.getMonth() + delta, 1);
  // День месяца сохраняем, но в коротком месяце он мог бы «перепрыгнуть».
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  return new Date(shifted.getFullYear(), shifted.getMonth(), Math.min(day.getDate(), lastDay));
}

export function startOfWeek(date: Date): Date {
  const shift = (date.getDay() + 6) % 7;
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -shift);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Адрес календаря с изменённым набором параметров. */
export function calendarHref(
  filter: CalendarFilter,
  changes: Partial<CalendarFilter> = {},
): string {
  const next = { ...filter, ...changes };
  const search = new URLSearchParams();
  if (next.view !== "month") search.set("view", next.view);
  search.set("day", dayKey(next.day));
  if (next.projectId) search.set("projectId", next.projectId);
  if (next.types.length !== ALL_CALENDAR_TYPES.length) search.set("types", next.types.join(","));
  if (next.showDuration) search.set("duration", "1");
  return `/calendar?${search.toString()}`;
}

/** Включить или выключить тип записей, не трогая остальные. */
export function toggleType(types: CalendarType[], value: CalendarType): CalendarType[] {
  return types.includes(value)
    ? types.filter((item) => item !== value)
    : ALL_CALENDAR_TYPES.filter((item) => types.includes(item) || item === value);
}

/**
 * Задача идёт полосой от постановки до срока. Полоса рисуется по дням, и для
 * каждого дня нужно знать, не начало ли это и не конец ли — только у них
 * скругляется край, а подпись стоит в первый видимый день.
 */
export function durationSlice(
  task: { startDate: Date | null; dueDate: Date | null },
  day: Date,
): { visible: boolean; first: boolean; last: boolean } {
  const hidden = { visible: false, first: false, last: false };
  if (!task.startDate || !task.dueDate) return hidden;

  const start = startOfDay(task.startDate);
  const due = startOfDay(task.dueDate);
  if (due < start) return hidden;

  const current = startOfDay(day);
  if (current < start || current > due) return hidden;

  return { visible: true, first: isSameDay(current, start), last: isSameDay(current, due) };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDay(value: string | undefined, fallback: Date): Date {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
