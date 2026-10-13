/**
 * Сроки задачи плана: старт, длительность в неделях и финиш. Достаточно двух
 * из трёх, третье вычисляется. Финиш — последний день работы включительно:
 * задача в одну неделю, начатая в понедельник, кончается в воскресенье.
 */

/** Календарь планирования: 2026–2027. Расширение — правка здесь. */
export const PLAN_CALENDAR = {
  from: new Date(2026, 0, 1),
  to: new Date(2027, 11, 31),
};

export type PlanDatesInput = {
  start: Date | null;
  weeks: number | null;
  finish: Date | null;
};

export type PlanDates = PlanDatesInput;

export type PlanDatesResult = { ok: true; value: PlanDates } | { ok: false; error: string };

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/** Число дней между датами без учёта времени. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function resolvePlanDates(
  input: PlanDatesInput,
  calendar: { from: Date; to: Date } = PLAN_CALENDAR,
): PlanDatesResult {
  const { start, weeks, finish } = input;
  const given = [start, weeks, finish].filter((value) => value !== null).length;

  if (weeks !== null && (!Number.isInteger(weeks) || weeks < 1)) {
    return { ok: false, error: "Длительность — целое число недель, не меньше одной" };
  }
  if (given === 1) {
    return {
      ok: false,
      error: "Укажите два значения из трёх: старт, длительность или финиш — третье посчитается",
    };
  }

  let value: PlanDates = { start, weeks, finish };
  if (given >= 2) {
    if (start && weeks !== null && !finish) {
      value = { start, weeks, finish: addDays(start, weeks * 7 - 1) };
    } else if (finish && weeks !== null && !start) {
      value = { start: addDays(finish, -(weeks * 7 - 1)), weeks, finish };
    } else if (start && finish) {
      if (finish < start) return { ok: false, error: "Финиш не может быть раньше старта" };
      const span = Math.ceil((daysBetween(start, finish) + 1) / 7);
      if (weeks !== null && weeks !== span) {
        return {
          ok: false,
          error: `Старт, длительность и финиш не сходятся: между датами ${span} нед. Оставьте два значения из трёх`,
        };
      }
      value = { start, weeks: span, finish };
    }
  }

  for (const date of [value.start, value.finish]) {
    if (date && (date < calendar.from || date > calendar.to)) {
      return {
        ok: false,
        error: `Сроки плана — в пределах календаря ${calendar.from.getFullYear()}–${calendar.to.getFullYear()}`,
      };
    }
  }
  return { ok: true, value };
}

/** Понедельник недели, в которую попадает дата. */
export function weekStart(date: Date): Date {
  const shift = (date.getDay() + 6) % 7;
  return addDays(date, -shift);
}

/** Номер недели по ISO: неделя с четвергом принадлежит его году. */
export function isoWeek(date: Date): { year: number; week: number } {
  const thursday = addDays(weekStart(date), 3);
  const firstThursday = addDays(weekStart(new Date(thursday.getFullYear(), 0, 4)), 3);
  return {
    year: thursday.getFullYear(),
    week: Math.round(daysBetween(firstThursday, thursday) / 7) + 1,
  };
}

export type PlanWeek = { start: Date; year: number; week: number };

/** Недели календаря планирования — шкала диаграммы. */
export function planWeeks(calendar: { from: Date; to: Date } = PLAN_CALENDAR): PlanWeek[] {
  const weeks: PlanWeek[] = [];
  for (let cursor = weekStart(calendar.from); cursor <= calendar.to; cursor = addDays(cursor, 7)) {
    weeks.push({ start: cursor, ...isoWeek(cursor) });
  }
  return weeks;
}

/** Индекс недели даты на шкале: от первой недели календаря. */
export function weekIndex(date: Date, calendar: { from: Date; to: Date } = PLAN_CALENDAR): number {
  return Math.floor(daysBetween(weekStart(calendar.from), weekStart(date)) / 7);
}
