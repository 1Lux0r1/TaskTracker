import { describe, expect, it } from "vitest";
import { cellDate, cellNumber, cellText } from "@/lib/excel/parse-cell";

describe("cellText", () => {
  it("разворачивает rich text и формулы", () => {
    expect(cellText({ richText: [{ text: "Согласовать " }, { text: "ТЗ" }] })).toBe(
      "Согласовать ТЗ",
    );
    expect(cellText({ formula: "A1&B1", result: "Итог" })).toBe("Итог");
  });

  it("возвращает null для пустых значений", () => {
    expect(cellText(null)).toBeNull();
    expect(cellText("   ")).toBeNull();
  });
});

describe("cellNumber", () => {
  it("читает числа с запятой, пробелами и процентом", () => {
    expect(cellNumber("1 250,5")).toBe(1250.5);
    expect(cellNumber("35%")).toBe(35);
    expect(cellNumber(42)).toBe(42);
  });

  it("возвращает null для текста", () => {
    expect(cellNumber("нет данных")).toBeNull();
  });
});

describe("cellDate", () => {
  it("читает настоящую дату", () => {
    const date = cellDate(new Date(Date.UTC(2026, 2, 10)));
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(10);
  });

  it("читает текстовые форматы", () => {
    expect(cellDate("10.03.2026")?.getDate()).toBe(10);
    expect(cellDate("2026-03-10")?.getMonth()).toBe(2);
    expect(cellDate("1/2/26")?.getFullYear()).toBe(2026);
  });

  it("читает серийный номер Excel", () => {
    // 44927 — 1 января 2023 года в системе дат Excel 1900.
    const date = cellDate(44_927);
    expect(date?.getFullYear()).toBe(2023);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(1);
  });

  it("учитывает несуществующее 29 февраля 1900 года в системе дат Excel", () => {
    // Excel считает 1900 високосным, поэтому серийные номера после 59 смещены на день.
    expect(cellDate(61)?.getMonth()).toBe(2);
    expect(cellDate(61)?.getDate()).toBe(1);
  });

  it("возвращает null для мусора", () => {
    expect(cellDate("скоро")).toBeNull();
    expect(cellDate(null)).toBeNull();
    expect(cellDate(0)).toBeNull();
  });
});
