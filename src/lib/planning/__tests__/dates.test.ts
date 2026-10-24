import { describe, expect, it } from "vitest";
import { isoWeek, planWeeks, resolvePlanDates, weekIndex } from "../dates";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

function ok(result: ReturnType<typeof resolvePlanDates>) {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("сроки задачи плана", () => {
  it("финиш из старта и длительности", () => {
    const value = ok(resolvePlanDates({ start: d(2026, 10, 5), weeks: 2, finish: null }));
    expect(value.finish).toEqual(d(2026, 10, 18));
  });

  it("старт из финиша и длительности", () => {
    const value = ok(resolvePlanDates({ start: null, weeks: 3, finish: d(2026, 10, 25) }));
    expect(value.start).toEqual(d(2026, 10, 5));
  });

  it("длительность из старта и финиша, неполная неделя округляется вверх", () => {
    expect(ok(resolvePlanDates({ start: d(2026, 10, 5), weeks: null, finish: d(2026, 10, 11) })).weeks).toBe(1);
    expect(ok(resolvePlanDates({ start: d(2026, 10, 5), weeks: null, finish: d(2026, 10, 13) })).weeks).toBe(2);
    expect(ok(resolvePlanDates({ start: d(2026, 10, 5), weeks: null, finish: d(2026, 10, 5) })).weeks).toBe(1);
  });

  it("через переход на новый год", () => {
    const value = ok(resolvePlanDates({ start: d(2026, 12, 28), weeks: 2, finish: null }));
    expect(value.finish).toEqual(d(2027, 1, 10));
  });

  it("без сроков задача допустима", () => {
    expect(ok(resolvePlanDates({ start: null, weeks: null, finish: null }))).toEqual({
      start: null,
      weeks: null,
      finish: null,
    });
  });

  it("одного значения мало", () => {
    expect(resolvePlanDates({ start: d(2026, 10, 5), weeks: null, finish: null }).ok).toBe(false);
  });

  it("финиш не раньше старта", () => {
    const result = resolvePlanDates({ start: d(2026, 10, 5), weeks: null, finish: d(2026, 10, 1) });
    expect(result).toEqual({ ok: false, error: "Финиш не может быть раньше старта" });
  });

  it("три несогласованных значения отклоняются", () => {
    expect(resolvePlanDates({ start: d(2026, 10, 5), weeks: 5, finish: d(2026, 10, 18) }).ok).toBe(false);
    expect(resolvePlanDates({ start: d(2026, 10, 5), weeks: 2, finish: d(2026, 10, 18) }).ok).toBe(true);
  });

  it("длительность — целое положительное число", () => {
    expect(resolvePlanDates({ start: d(2026, 10, 5), weeks: 0, finish: null }).ok).toBe(false);
    expect(resolvePlanDates({ start: d(2026, 10, 5), weeks: 1.5, finish: null }).ok).toBe(false);
  });

  it("сроки вне календаря 2025–2029 отклоняются", () => {
    expect(resolvePlanDates({ start: d(2024, 12, 1), weeks: 1, finish: null }).ok).toBe(false);
    expect(resolvePlanDates({ start: d(2029, 12, 27), weeks: 2, finish: null }).ok).toBe(false);
    expect(resolvePlanDates({ start: d(2025, 4, 1), weeks: 4, finish: null }).ok).toBe(true);
  });
});

describe("недели календаря", () => {
  it("номер недели по ISO", () => {
    expect(isoWeek(d(2026, 1, 1))).toEqual({ year: 2026, week: 1 });
    expect(isoWeek(d(2026, 10, 13))).toEqual({ year: 2026, week: 42 });
    expect(isoWeek(d(2027, 1, 1))).toEqual({ year: 2026, week: 53 });
  });

  it("шкала идёт неделями с понедельника", () => {
    const calendar = { from: d(2026, 1, 1), to: d(2027, 12, 31) };
    const weeks = planWeeks(calendar);
    expect(weeks[0].start).toEqual(d(2025, 12, 29));
    expect(weeks.at(-1)!.start).toEqual(d(2027, 12, 27));
    expect(weeks).toHaveLength(105);
    expect(weekIndex(d(2026, 1, 5), calendar)).toBe(1);
  });
});
