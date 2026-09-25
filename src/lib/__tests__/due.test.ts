import { describe, expect, it } from "vitest";
import { daysUntil, describeDue } from "@/lib/domain";

const today = new Date(2026, 8, 25);

describe("срок словами", () => {
  it("считает дни до срока и дни просрочки", () => {
    expect(daysUntil(new Date(2026, 8, 30), today)).toBe(5);
    expect(daysUntil(new Date(2026, 8, 20), today)).toBe(-5);
    expect(daysUntil(new Date(2026, 8, 25, 15, 30), today)).toBe(0);
  });

  it("просрочку пишет днями, а не датой", () => {
    expect(describeDue(new Date(2026, 7, 7), { today })).toEqual({
      state: "over",
      text: "просрочка 49 дн.",
      days: -49,
    });
  });

  it("ближайшую неделю называет «через N дн.», дальше — датой", () => {
    expect(describeDue(new Date(2026, 8, 25), { today }).text).toBe("сегодня");
    expect(describeDue(new Date(2026, 9, 2), { today }).text).toBe("через 7 дн.");
    expect(describeDue(new Date(2026, 9, 3), { today })).toMatchObject({ state: "later", text: "03.10" });
  });

  it("у закрытой записи просрочки нет", () => {
    expect(describeDue(new Date(2026, 7, 7), { today, closed: true }).state).toBe("done");
    expect(describeDue(null).text).toBe("без срока");
  });
});
