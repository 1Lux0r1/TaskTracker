import { describe, expect, it } from "vitest";
import { columnSpan, overlapsPeriod, parsePlanPeriod, periodLabel, periodSearch, planColumns } from "../period";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const today = d(2026, 10, 24);

describe("период плана", () => {
  it("по умолчанию — текущий год по неделям", () => {
    const period = parsePlanPeriod({}, today);
    expect(period).toEqual({ preset: "year", scale: "week", from: d(2026, 1, 1), to: d(2026, 12, 31) });
  });

  it("заготовки квартала и полугодия считаются от сегодня", () => {
    expect(parsePlanPeriod({ period: "quarter" }, today)).toMatchObject({ from: d(2026, 10, 1), to: d(2026, 12, 31) });
    expect(parsePlanPeriod({ period: "half" }, today)).toMatchObject({ from: d(2026, 7, 1), to: d(2026, 12, 31) });
  });

  it("свой период берёт месяцы целиком и меняет перепутанные местами", () => {
    expect(parsePlanPeriod({ from: "2026-03", to: "2026-05", scale: "month" }, today)).toEqual({
      preset: "custom",
      scale: "month",
      from: d(2026, 3, 1),
      to: d(2026, 5, 31),
    });
    expect(parsePlanPeriod({ period: "custom", from: "2026-05", to: "2026-03" }, today)).toMatchObject({
      from: d(2026, 3, 1),
      to: d(2026, 5, 31),
    });
  });

  it("заготовка важнее месяцев: месяцы оставлены формой от прежнего выбора", () => {
    expect(parsePlanPeriod({ period: "quarter", from: "2025-01", to: "2025-02" }, today)).toMatchObject({
      preset: "quarter",
      from: d(2026, 10, 1),
    });
  });

  it("весь план тянется по задачам, без задач — на календарь", () => {
    const span = { from: d(2025, 4, 14), to: d(2027, 3, 10) };
    expect(parsePlanPeriod({ period: "all" }, today, span)).toMatchObject({ from: d(2025, 4, 1), to: d(2027, 3, 31) });
    expect(parsePlanPeriod({ period: "all" }, today, null)).toMatchObject({ from: d(2025, 1, 1), to: d(2029, 12, 31) });
  });

  it("не выходит за календарь", () => {
    expect(parsePlanPeriod({ from: "2020-01", to: "2031-12" }, today)).toMatchObject({
      from: d(2025, 1, 1),
      to: d(2029, 12, 31),
    });
  });

  it("подпись и параметры адреса", () => {
    const period = parsePlanPeriod({ from: "2026-03", to: "2026-05", scale: "month" }, today);
    expect(periodLabel(period)).toBe("мар 2026 – май 2026, по месяцам");
    expect(periodSearch(period)).toEqual({ period: "custom", from: "2026-03", to: "2026-05", scale: "month" });
    expect(periodSearch(parsePlanPeriod({}, today))).toEqual({ period: "year", scale: "week" });
  });
});

describe("колонки и полосы", () => {
  it("месяцы — календарные, с годом в группе", () => {
    const columns = planColumns(parsePlanPeriod({ from: "2026-11", to: "2027-02", scale: "month" }, today));
    expect(columns.map((column) => `${column.label} ${column.group}`)).toEqual([
      "ноя 2026",
      "дек 2026",
      "янв 2027",
      "фев 2027",
    ]);
    expect(columns[1].end).toEqual(d(2026, 12, 31));
  });

  it("недели — с понедельника, номер по ISO, месяц по четвергу", () => {
    const columns = planColumns(parsePlanPeriod({ period: "quarter" }, today));
    expect(columns[0].start).toEqual(d(2026, 9, 28));
    expect(columns[0].label).toBe("40");
    expect(columns[0].group).toBe("окт 2026");
    expect(columns.at(-1)!.start).toEqual(d(2026, 12, 28));
  });

  it("полоса обрезается краями периода, задача вне периода не рисуется", () => {
    const columns = planColumns(parsePlanPeriod({ from: "2026-03", to: "2026-05", scale: "month" }, today));
    expect(columnSpan(columns, d(2026, 1, 10), d(2026, 4, 2))).toEqual({ first: 0, last: 1 });
    expect(columnSpan(columns, d(2026, 7, 1), d(2026, 8, 1))).toBeNull();
    expect(overlapsPeriod({ startDate: d(2026, 5, 31), finishDate: d(2026, 6, 5) }, { from: d(2026, 3, 1), to: d(2026, 5, 31) })).toBe(true);
    expect(overlapsPeriod({ startDate: null, finishDate: null }, { from: d(2026, 3, 1), to: d(2026, 5, 31) })).toBe(false);
  });
});
