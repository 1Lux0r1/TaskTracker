import { describe, expect, it } from "vitest";
import {
  STALE_DAYS,
  dayStamp,
  daysWithoutMovement,
  isStale,
  notificationKey,
  notificationKindLabel,
  weekStamp,
} from "@/lib/notifications";

const today = new Date(2026, 8, 23);

describe("notificationKey", () => {
  it("одно событие — один ключ: список не задваивается при каждом открытии", () => {
    const first = notificationKey("OVERDUE", "TASK", "t1", dayStamp(new Date(2026, 8, 18)));
    const second = notificationKey("OVERDUE", "TASK", "t1", dayStamp(new Date(2026, 8, 18, 23, 59)));
    expect(first).toBe(second);
  });

  it("перенос срока — новое событие", () => {
    const before = notificationKey("DUE_CHANGED", "TASK", "t1", dayStamp(new Date(2026, 8, 25)));
    const after = notificationKey("DUE_CHANGED", "TASK", "t1", dayStamp(new Date(2026, 9, 2)));
    expect(before).not.toBe(after);
  });

  it("снятый срок тоже ключ, а не пустота", () => {
    expect(dayStamp(null)).toBe("none");
  });
});

describe("weekStamp", () => {
  it("о записи без движения напоминаем не чаще раза в неделю", () => {
    expect(weekStamp(today)).toBe(weekStamp(new Date(2026, 8, 24)));
    expect(weekStamp(today)).not.toBe(weekStamp(new Date(2026, 9, 8)));
  });
});

describe("isStale", () => {
  it("две недели без правок — запись без движения", () => {
    expect(isStale(new Date(2026, 8, 9), today)).toBe(true);
    expect(isStale(new Date(2026, 8, 20), today)).toBe(false);
    expect(STALE_DAYS).toBe(14);
  });

  it("считает дни простоя для текста уведомления", () => {
    expect(daysWithoutMovement(new Date(2026, 8, 9), today)).toBe(14);
  });

  it("ровно двадцать дней — это двадцать, а не девятнадцать", () => {
    // Счёт идёт от текущего момента: от начала суток ровные двадцать дней
    // превращались в «19 дн.».
    const now = new Date(2026, 8, 23, 17, 30);
    expect(daysWithoutMovement(new Date(2026, 8, 3, 17, 30), now)).toBe(20);
  });
});

describe("notificationKindLabel", () => {
  it("называет вид события по-русски", () => {
    expect(notificationKindLabel("STALE")).toBe("Без движения");
    expect(notificationKindLabel("WAT")).toBe("WAT");
  });
});
