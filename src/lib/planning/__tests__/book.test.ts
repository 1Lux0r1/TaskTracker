import { describe, expect, it } from "vitest";
import { dkStatusOf, parseBook, resolveCell, stageLevel } from "../book";
import { BOOK } from "./book-fixture";

describe("разбор книги планирования", () => {
  const book = parseBook(BOOK);

  it("читает справочник: подсистемы, этапы с уровнем, реестр МС с номером в подсистеме", () => {
    expect(book.subsystems.map((item) => item.code)).toEqual(["TA", "REP"]);
    expect(book.stages).toEqual([
      { code: "ОА", name: "Отраслевой анализ", level: "DK", sortOrder: 1 },
      { code: "Арх", name: "Архитектура", level: "DK_OR_MS", sortOrder: 2 },
      { code: "Р", name: "Разработка", level: "MS", sortOrder: 3 },
    ]);
    expect(book.modules[0]).toEqual({
      system: "RKII",
      number: 8,
      name: "terra-analyser-bff",
      subsystem: "TA",
      subsystemNumber: 3,
      version: "1.0.0",
    });
  });

  it("отделяет области от направлений и не берёт список приоритетов за приоритет", () => {
    expect(book.areas).toEqual([{ code: "TA", name: "Территориальный анализ" }]);
    expect(book.directions.map((item) => item.code)).toEqual(["TATep", "Base"]);
    expect(book.systemName).toBe("АИС РКИИЭ");
  });

  it("берёт разделы из ОФТ и пункты из дорожной карты со статусом и сроком", () => {
    expect(book.parts).toContainEqual({ direction: "TATep", code: "1", name: "Трассировка" });
    expect(book.dks[1]).toEqual({
      direction: "TATep",
      part: "1",
      number: 2,
      name: "Path-finder",
      status: "PRESTUDY",
      deadline: new Date(2026, 9, 31),
      owner: "ОА",
    });
    expect(book.problems).toContain("«Дорожная карта», строка 6: RKII.Base.1.1 — раздела Base.1 нет");
  });

  it("собирает задачи плана: пункт по ссылке, этап с повтором, сроки по закраске или по сроку", () => {
    expect(book.tasks.map((task) => `${task.direction}.${task.part}.${task.dk}.${task.subsystem}.${task.msNumber}.${task.stage}${task.repeat}`)).toEqual([
      "TATep.1.1.TA.1.Р1",
      "TATep.1.1.TA.1.Р2",
      "Base.1.1.TA.3.Арх1",
    ]);
    expect(book.tasks[0]).toMatchObject({ startDate: new Date(2026, 8, 1), finishDate: new Date(2026, 9, 31), status: "Выполнено" });
    expect(book.tasks[1]).toMatchObject({ startDate: new Date(2026, 10, 1), finishDate: new Date(2026, 10, 30) });
    expect(book.tasks[2]).toMatchObject({ startDate: new Date(2026, 10, 1), finishDate: new Date(2026, 10, 30) });
  });

  it("складывает несходящееся в замечания, а не падает", () => {
    expect(book.problems).toContain("«План работ», строка 8, TA.1.Ого: этапа «Ого» нет в справочнике");
    expect(book.problems).toContain("«План работ», строка 9: код МС «TA.1(2).» не по правилу ПОДСИСТЕМА.МС.ЭТАП — строка пропущена");
  });
});

describe("правила разбора", () => {
  it("уровень этапа", () => {
    expect(stageLevel("Бизнес")).toBe("DK");
    expect(stageLevel("Бизнес/МС")).toBe("DK_OR_MS");
    expect(stageLevel("МС")).toBe("MS");
  });

  it("статус пункта", () => {
    expect(dkStatusOf("Выполнено")).toBe("DONE");
    expect(dkStatusOf("Заморожено / отменено")).toBe("FROZEN");
    expect(dkStatusOf("В работе")).toBe("PRODUCTION");
    expect(dkStatusOf("Анализ")).toBe("ANALYSIS");
    expect(dkStatusOf("В очереди")).toBe("PRESTUDY");
  });

  it("разворачивает цепочку ссылок между листами", () => {
    const plan = BOOK[3];
    expect(resolveCell(BOOK, plan, plan.rows[6][1])).toBe("RKII.TATep.1.1");
    expect(resolveCell(BOOK, plan, { value: null, formula: "B6&C6" })).toBe("");
  });
});
