import { describe, expect, it } from "vitest";
import {
  ALL_CALENDAR_TYPES,
  buildMonthGrid,
  buildWeekDays,
  calendarHref,
  calendarRange,
  dayKey,
  durationSlice,
  readCalendarFilter,
  shiftCalendar,
  toggleType,
} from "@/lib/calendar";

const TODAY = new Date(2026, 8, 23); // среда, 23 сентября 2026

describe("readCalendarFilter", () => {
  it("по умолчанию — месяц, сегодняшний день и все типы записей", () => {
    const filter = readCalendarFilter({}, TODAY);
    expect(filter.view).toBe("month");
    expect(dayKey(filter.day)).toBe("2026-09-23");
    expect(filter.types).toEqual(ALL_CALENDAR_TYPES);
    expect(filter.showDuration).toBe(false);
  });

  it("незнакомый режим и мусор в дате не ломают страницу", () => {
    const filter = readCalendarFilter({ view: "год", day: "вчера" }, TODAY);
    expect(filter.view).toBe("month");
    expect(dayKey(filter.day)).toBe("2026-09-23");
  });

  it("пустой список типов значит «ничего не показывать», а не «показать всё»", () => {
    expect(readCalendarFilter({ types: "" }, TODAY).types).toEqual([]);
    expect(readCalendarFilter({ types: "meeting,task" }, TODAY).types).toEqual(["meeting", "task"]);
  });
});

describe("calendarRange", () => {
  it("месяц — от первого до последнего числа", () => {
    const { start, end } = calendarRange("month", TODAY);
    expect(dayKey(start)).toBe("2026-09-01");
    expect(dayKey(end)).toBe("2026-09-30");
  });

  it("неделя считается с понедельника", () => {
    const { start, end } = calendarRange("week", TODAY);
    expect(dayKey(start)).toBe("2026-09-21");
    expect(dayKey(end)).toBe("2026-09-27");
  });
});

describe("сетка месяца", () => {
  it("состоит из целых недель и захватывает хвосты соседних месяцев", () => {
    const grid = buildMonthGrid(TODAY);
    expect(grid.length % 7).toBe(0);
    expect(dayKey(grid[0])).toBe("2026-08-31");
    expect(dayKey(grid[grid.length - 1])).toBe("2026-10-04");
  });

  it("неделя — семь дней с понедельника", () => {
    const week = buildWeekDays(TODAY);
    expect(week.map(dayKey)).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24",
      "2026-09-25", "2026-09-26", "2026-09-27",
    ]);
  });
});

describe("shiftCalendar", () => {
  it("в месячном виде шагает месяцами, в недельном — неделями", () => {
    expect(dayKey(shiftCalendar("month", TODAY, 1))).toBe("2026-10-23");
    expect(dayKey(shiftCalendar("week", TODAY, -1))).toBe("2026-09-16");
  });

  it("31-е число не перепрыгивает через короткий месяц", () => {
    expect(dayKey(shiftCalendar("month", new Date(2026, 9, 31), 1))).toBe("2026-11-30");
  });
});

describe("toggleType", () => {
  it("включает и выключает тип, сохраняя порядок остальных", () => {
    expect(toggleType(ALL_CALENDAR_TYPES, "letter")).toEqual(["task", "document", "meeting"]);
    expect(toggleType(["task"], "meeting")).toEqual(["task", "meeting"]);
  });
});

describe("calendarHref", () => {
  it("в адрес попадает только то, что отличается от умолчания", () => {
    const filter = readCalendarFilter({}, TODAY);
    expect(calendarHref(filter)).toBe("/calendar?day=2026-09-23");
    expect(calendarHref(filter, { view: "week", showDuration: true })).toBe(
      "/calendar?view=week&day=2026-09-23&duration=1",
    );
  });
});

describe("durationSlice", () => {
  const task = { startDate: new Date(2026, 8, 21), dueDate: new Date(2026, 8, 24) };

  it("полоса видна только внутри интервала", () => {
    expect(durationSlice(task, new Date(2026, 8, 20)).visible).toBe(false);
    expect(durationSlice(task, new Date(2026, 8, 22)).visible).toBe(true);
    expect(durationSlice(task, new Date(2026, 8, 25)).visible).toBe(false);
  });

  it("края интервала отмечаются отдельно", () => {
    expect(durationSlice(task, new Date(2026, 8, 21))).toEqual({
      visible: true, first: true, last: false,
    });
    expect(durationSlice(task, new Date(2026, 8, 24))).toEqual({
      visible: true, first: false, last: true,
    });
  });

  it("без одной из дат и при сроке раньше постановки полосы нет", () => {
    expect(durationSlice({ startDate: null, dueDate: TODAY }, TODAY).visible).toBe(false);
    expect(
      durationSlice({ startDate: new Date(2026, 8, 25), dueDate: new Date(2026, 8, 20) }, TODAY)
        .visible,
    ).toBe(false);
  });
});
