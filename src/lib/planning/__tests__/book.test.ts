import { describe, expect, it } from "vitest";
import { parseBook, priorityOf, stageLevel } from "../book";

describe("разбор книги планирования", () => {
  it("находит таблицы по шапкам, где бы они ни лежали на листе", () => {
    const book = parseBook([
      {
        name: "Справочник",
        rows: [
          ["Справочник подсистем и МС", null, null, null],
          [null, null, null, null],
          ["Код подсистемы", "Название", null, null],
          ["TA", "Terra Analyser", null, null],
          ["UI", "Интерфейс", null, null],
          [null, null, null, null],
          ["№ МС", "Микросервис", "Подсистема", "Версия"],
          [8, "terra-analyser-bff", "TA", "1.2"],
          ["09", "ui-shell", "UI", null],
          [null, null, null, null],
          ["Код этапа", "Название", "Уровень", null],
          ["БА", "Бизнес-анализ", "ДК / МС", null],
          ["Арх", "Архитектура", "ДК", null],
          ["Р", "Разработка", "МС", null],
        ],
      },
      {
        name: "Направления",
        rows: [
          ["Код", "Название", "Цель", "Срок", "Приоритет", "Дата решения", "Основание", "ОФТ согласован"],
          ["Gaz", "Газоснабжение", "Цель", new Date(2027, 5, 30), "Главное", "01.09.2026", "Протокол", null],
          ["Ele", "Электроснабжение", null, null, "Отложено", null, null, null],
          [null, null, null, null, null, null, null, null],
          ["Направление", "Код части", "Название части"],
          ["Gaz", "Rte", "Трассировки"],
        ],
      },
    ]);

    expect(book.subsystems).toEqual([
      { code: "TA", name: "Terra Analyser" },
      { code: "UI", name: "Интерфейс" },
    ]);
    expect(book.modules).toEqual([
      { number: 8, name: "terra-analyser-bff", subsystem: "TA", version: "1.2" },
      { number: 9, name: "ui-shell", subsystem: "UI", version: null },
    ]);
    expect(book.stages.map((s) => [s.code, s.level])).toEqual([
      ["БА", "DK_OR_MS"],
      ["Арх", "DK"],
      ["Р", "MS"],
    ]);
    expect(book.directions[0]).toMatchObject({
      code: "Gaz",
      priority: "MAIN",
      decisionDate: new Date(2026, 8, 1),
      deadline: new Date(2027, 5, 30),
    });
    expect(book.directions[1].priority).toBe("DEFERRED");
    expect(book.parts).toEqual([{ direction: "Gaz", code: "Rte", name: "Трассировки" }]);
    expect(book.found).toHaveLength(5);
  });

  it("уровень этапа и приоритет по подписи", () => {
    expect(stageLevel("МС")).toBe("MS");
    expect(stageLevel("ДК")).toBe("DK");
    expect(stageLevel("ДК, если указан МС — МС")).toBe("DK_OR_MS");
    expect(priorityOf("Обеспечивающее")).toBe("SUPPORT");
  });
});
