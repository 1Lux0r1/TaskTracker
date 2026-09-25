import { describe, expect, it } from "vitest";
import {
  buildMeetingOrderBy,
  buildMeetingWhere,
  countActiveMeetingFilters,
  readMeetingFilter,
} from "@/lib/meeting-filters";
import { formatMeetingTime, isUpcomingMeeting, meetingKindLabel } from "@/lib/domain";

const TODAY = new Date("2026-09-23T00:00:00");

describe("readMeetingFilter", () => {
  it("по умолчанию показывает все встречи: экран сам делит их на ближайшие и прошедшие", () => {
    const filter = readMeetingFilter({});
    expect(filter.preset).toBe("all");
    expect(filter.kind).toBe("");
    expect(filter.query).toBe("");
  });

  it("отбрасывает вид и выборку, которых нет в справочнике", () => {
    const filter = readMeetingFilter({ kind: "ЧТО-ТО", preset: "ЧТО-ТО" });
    expect(filter.kind).toBe("");
    expect(filter.preset).toBe("all");
  });
});

describe("buildMeetingWhere", () => {
  it("предстоящие — от сегодняшнего дня, прошедшие — до него", () => {
    expect(buildMeetingWhere(readMeetingFilter({ preset: "upcoming" }), TODAY).date).toEqual({
      gte: TODAY,
    });
    expect(buildMeetingWhere(readMeetingFilter({}), TODAY).date).toBeUndefined();
    expect(buildMeetingWhere(readMeetingFilter({ preset: "past" }), TODAY).date).toEqual({
      lt: TODAY,
    });
  });

  it("«без решений» ищет только среди уже прошедших", () => {
    const where = buildMeetingWhere(readMeetingFilter({ preset: "noDecisions" }), TODAY);
    expect(where.date).toEqual({ lte: TODAY });
    expect(where.OR).toEqual([{ decisions: null }, { decisions: "" }]);
  });

  it("каждое слово запроса должно встретиться", () => {
    const where = buildMeetingWhere(readMeetingFilter({ q: "Рабочая Встреча" }), TODAY);
    expect(where.AND).toEqual([
      { searchIndex: { contains: "рабочая" } },
      { searchIndex: { contains: "встреча" } },
    ]);
  });
});

describe("buildMeetingOrderBy", () => {
  it("предстоящие идут от ближайшей, прошедшие — от последней", () => {
    expect(buildMeetingOrderBy("upcoming")[0]).toEqual({ date: "asc" });
    expect(buildMeetingOrderBy("past")[0]).toEqual({ date: "desc" });
  });
});

describe("countActiveMeetingFilters", () => {
  it("считает только заданные условия", () => {
    expect(countActiveMeetingFilters(readMeetingFilter({}))).toBe(0);
    expect(countActiveMeetingFilters(readMeetingFilter({ preset: "past", q: "акт" }))).toBe(2);
  });
});

describe("подписи встречи", () => {
  it("время показывается промежутком, а одно начало — само по себе", () => {
    expect(formatMeetingTime("10:00", "11:30")).toBe("10:00 — 11:30");
    expect(formatMeetingTime("10:00", null)).toBe("с 10:00");
    expect(formatMeetingTime(null, null)).toBe("");
  });

  it("сегодняшняя встреча считается предстоящей", () => {
    expect(isUpcomingMeeting(new Date("2026-09-23T15:00:00"), TODAY)).toBe(true);
    expect(isUpcomingMeeting(new Date("2026-09-22T15:00:00"), TODAY)).toBe(false);
  });

  it("незнакомый вид встречи показывается как есть", () => {
    expect(meetingKindLabel("WORKING")).toBe("Рабочая");
    expect(meetingKindLabel("ЧТО-ТО")).toBe("ЧТО-ТО");
  });
});
