import { describe, expect, it } from "vitest";
import {
  buildTrend,
  changeLabel,
  chartPoints,
  polylinePoints,
  readTrendWeeks,
  trendChange,
  trendDates,
} from "@/lib/trend";

const today = new Date(2026, 8, 23);
const day = (n: number) => new Date(2026, 8, n);

describe("trendDates", () => {
  it("по точке на неделю, последняя — сегодня", () => {
    const dates = trendDates(today, 4);
    expect(dates).toHaveLength(5);
    expect(dates[4].getTime()).toBe(today.getTime());
    expect(dates[3].getTime()).toBe(new Date(2026, 8, 16).getTime());
  });
});

describe("readTrendWeeks", () => {
  it("чужое значение из адреса не ломает страницу", () => {
    expect(readTrendWeeks("4")).toBe(4);
    expect(readTrendWeeks("26")).toBe(26);
    expect(readTrendWeeks("999")).toBe(12);
    expect(readTrendWeeks(undefined)).toBe(12);
  });
});

describe("buildTrend", () => {
  const records = [
    { dueDate: day(10), closedAt: day(9) }, // закрыта вовремя
    { dueDate: day(12), closedAt: day(20) }, // закрыта с опозданием
    { dueDate: day(15), closedAt: null }, // просрочена и открыта
    { dueDate: null, closedAt: null }, // без срока
  ];

  it("на каждый день считает закрытое и просроченное", () => {
    const [start, middle, end] = buildTrend(records, [day(5), day(16), day(23)]);

    expect(start).toMatchObject({ done: 0, overdue: 0, readiness: 0 });
    // К 16-му закрыта одна, а две другие уже просрочены.
    expect(middle).toMatchObject({ done: 1, overdue: 2, readiness: 25 });
    // К 23-му закрыты две, просрочена одна; запись без срока не просрочена.
    expect(end).toMatchObject({ done: 2, overdue: 1, readiness: 50 });
  });

  it("закрытая с опозданием запись перестаёт быть просроченной", () => {
    const late = [{ dueDate: day(12), closedAt: day(20) }];
    expect(buildTrend(late, [day(18)])[0].overdue).toBe(1);
    expect(buildTrend(late, [day(21)])[0].overdue).toBe(0);
  });

  it("закрытое сегодня днём попадает в сегодняшнюю точку", () => {
    // Правый край графика должен совпадать с цифрами вверху страницы, а те
    // считаются на текущий момент, а не на начало суток.
    const closedToday = [{ dueDate: day(30), closedAt: new Date(2026, 8, 23, 14, 30) }];
    expect(buildTrend(closedToday, [today])[0]).toMatchObject({ done: 1, readiness: 100 });
  });

  it("пустой список не делит на ноль", () => {
    expect(buildTrend([], [day(23)])[0]).toMatchObject({ done: 0, readiness: 0 });
  });
});

describe("trendChange", () => {
  it("показывает разницу между краями периода", () => {
    expect(trendChange([10, 20, 35])).toBe(25);
    expect(trendChange([8, 3])).toBe(-5);
    expect(trendChange([7])).toBe(0);
  });

  it("подписывает изменение знаком", () => {
    expect(changeLabel(12, "%")).toBe("+12 %");
    expect(changeLabel(-3)).toBe("−3");
    expect(changeLabel(0)).toBe("без изменений");
  });
});

describe("chartPoints", () => {
  it("растягивает точки по ширине и переворачивает ось", () => {
    const points = chartPoints([0, 5, 10], 100, 40);
    expect(points[0]).toEqual({ x: 0, y: 40 });
    expect(points[2]).toEqual({ x: 100, y: 0 });
    expect(polylinePoints(points)).toBe("0,40 50,20 100,0");
  });

  it("общий потолок держит два графика в одном масштабе", () => {
    expect(chartPoints([5], 100, 40, 10)[0].y).toBe(20);
  });

  it("ровная линия не улетает в бесконечность", () => {
    expect(chartPoints([0, 0], 100, 40)).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 40 },
    ]);
  });
});
