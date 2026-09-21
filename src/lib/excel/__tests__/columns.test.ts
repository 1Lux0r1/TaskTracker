import { describe, expect, it } from "vitest";
import {
  isSummaryTitle,
  matchColumns,
  parsePriority,
  parseStatus,
} from "@/lib/excel/columns";

describe("matchColumns", () => {
  it("распознаёт канонические заголовки", () => {
    const columns = matchColumns(["ID", "Задача", "Статус", "Ответственный", "Срок"]);
    expect([...columns.values()]).toEqual([
      "externalKey",
      "title",
      "status",
      "assignee",
      "dueDate",
    ]);
  });

  it("находит поле по синониму и по вхождению слова", () => {
    const columns = matchColumns([
      "№",
      "Наименование работы",
      "Состояние",
      "Важность",
      "Дедлайн",
    ]);
    expect(columns.get(1)).toBe("title");
    expect(columns.get(2)).toBe("status");
    expect(columns.get(3)).toBe("priority");
    expect(columns.get(4)).toBe("dueDate");
  });

  it("не путает «Дата начала» с «Сроком», когда есть обе колонки", () => {
    const columns = matchColumns(["Задача", "Дата начала", "Дата окончания"]);
    expect(columns.get(1)).toBe("startDate");
    expect(columns.get(2)).toBe("dueDate");
  });

  it("игнорирует регистр, ё и лишние пробелы", () => {
    const columns = matchColumns(["  ЗАДАЧА ", "Трудоёмкость"]);
    expect(columns.get(0)).toBe("title");
    expect(columns.get(1)).toBe("estimateHours");
  });

  it("не назначает одно поле двум колонкам", () => {
    const columns = matchColumns(["Задача", "Название"]);
    expect([...columns.values()].filter((key) => key === "title")).toHaveLength(1);
  });

  it("пропускает пустые заголовки", () => {
    const columns = matchColumns(["", null, "Задача", undefined]);
    expect(columns.size).toBe(1);
    expect(columns.get(2)).toBe("title");
  });
});

describe("parseStatus", () => {
  it.each([
    ["Выполнено", "DONE"],
    ["в работе", "IN_PROGRESS"],
    ["Не начата", "TODO"],
    ["На проверке", "REVIEW"],
    ["Отменена", "CANCELLED"],
    ["Бэклог", "BACKLOG"],
    ["done", "DONE"],
  ])("«%s» → %s", (input, expected) => {
    expect(parseStatus(input)).toBe(expected);
  });

  it("возвращает null для неизвестного значения", () => {
    expect(parseStatus("непонятно")).toBeNull();
    expect(parseStatus("")).toBeNull();
    expect(parseStatus(null)).toBeNull();
  });
});

describe("parsePriority", () => {
  it.each([
    ["Критично", "CRITICAL"],
    ["срочно", "CRITICAL"],
    ["Высокий", "HIGH"],
    ["средняя", "MEDIUM"],
    ["low", "LOW"],
  ])("«%s» → %s", (input, expected) => {
    expect(parsePriority(input)).toBe(expected);
  });
});

describe("isSummaryTitle", () => {
  it("узнаёт строки итогов", () => {
    expect(isSummaryTitle("Итого")).toBe(true);
    expect(isSummaryTitle("ВСЕГО")).toBe(true);
    expect(isSummaryTitle("Итого по проекту")).toBe(true);
  });

  it("не трогает обычные задачи", () => {
    expect(isSummaryTitle("Подвести итоги спринта")).toBe(false);
  });
});
