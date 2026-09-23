import { describe, expect, it } from "vitest";
import { breakdownText, greeting, greetingName, segmentShares } from "@/lib/today";

const bar = "bg-gray-300";

describe("greetingName", () => {
  it("берёт имя из ФИО: в справочнике фамилия стоит первой", () => {
    expect(greetingName("Сидоров Алексей Петрович")).toBe("Алексей");
    expect(greetingName("Петрова Мария")).toBe("Мария");
  });

  it("своё имя для обращения важнее ФИО", () => {
    expect(greetingName("Сидоров Алексей Петрович", "Лёша")).toBe("Лёша");
    expect(greetingName("Сидоров Алексей", "   ")).toBe("Алексей");
  });

  it("одно слово в ФИО остаётся именем", () => {
    expect(greetingName("Шаганова")).toBe("Шаганова");
    expect(greetingName("")).toBe("");
  });
});

describe("greeting", () => {
  it("меняется по времени суток", () => {
    expect(greeting(new Date(2026, 8, 23, 3), "Алексей")).toBe("Доброй ночи, Алексей");
    expect(greeting(new Date(2026, 8, 23, 9), "Алексей")).toBe("Доброе утро, Алексей");
    expect(greeting(new Date(2026, 8, 23, 14), "Алексей")).toBe("Добрый день, Алексей");
    expect(greeting(new Date(2026, 8, 23, 21), "Алексей")).toBe("Добрый вечер, Алексей");
  });

  it("без имени обходится без запятой", () => {
    expect(greeting(new Date(2026, 8, 23, 14), "")).toBe("Добрый день");
  });
});

describe("segmentShares", () => {
  it("пустые куски не показываются, а доли дотягиваются до ста процентов", () => {
    const shares = segmentShares([
      { key: "a", label: "А", count: 1, bar },
      { key: "b", label: "Б", count: 0, bar },
      { key: "c", label: "В", count: 2, bar },
    ]);
    expect(shares.map((share) => share.key)).toEqual(["a", "c"]);
    expect(shares.reduce((total, share) => total + share.percent, 0)).toBe(100);
  });

  it("полосы нет, когда считать нечего", () => {
    expect(segmentShares([{ key: "a", label: "А", count: 0, bar }])).toEqual([]);
  });
});

describe("breakdownText", () => {
  it("перечисляет только непустое", () => {
    expect(
      breakdownText([
        { key: "a", label: "В работе", count: 5, bar },
        { key: "b", label: "На проверке", count: 0, bar },
        { key: "c", label: "Новая", count: 2, bar },
      ]),
    ).toBe("в работе 5 · новая 2");
  });

  it("пустой состав говорит об этом словами", () => {
    expect(breakdownText([{ key: "a", label: "В работе", count: 0, bar }])).toBe("пока пусто");
  });
});
