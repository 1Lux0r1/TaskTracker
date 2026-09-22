import { describe, expect, it } from "vitest";
import {
  DOCUMENT_COLUMNS,
  LETTER_COLUMNS,
  isRefusalNote,
  matchColumns,
  parseLetterDirection,
  parseLetterStatus,
  parsePartyStatus,
  partyFromHeader,
} from "@/lib/excel/columns";
import { deriveDocumentStatus, signatureProgress } from "@/lib/domain";
import { buildSearchIndex, normalizeQuery } from "@/lib/search";

describe("реестр переписки", () => {
  it("распознаёт шапку реального реестра ЭДО", () => {
    const columns = matchColumns(
      [
        "№", "Номер письма", "Дата письма", "Тема", "Ссылка на письмо", "Тип",
        "Контрагент", "Срок исполнения", "Просроченные", "Ответ реквизиты",
        "Статус", "Задача в Jira", "Комментарий",
      ],
      LETTER_COLUMNS,
    );
    const keys = [...columns.values()];
    expect(keys).toContain("number");
    expect(keys).toContain("subject");
    expect(keys).toContain("direction");
    expect(keys).toContain("counterparty");
    expect(keys).toContain("dueDate");
    expect(keys).toContain("status");
  });

  it("разбирает направление письма", () => {
    expect(parseLetterDirection("Входящее")).toBe("INCOMING");
    expect(parseLetterDirection("исходящее")).toBe("OUTGOING");
    expect(parseLetterDirection("непонятно")).toBeNull();
  });

  it.each([
    ["Подписано", "SIGNED"],
    ["Принято к сведению", "NOTED"],
    ["Дан ответ", "ANSWERED"],
    ["в работе", "IN_PROGRESS"],
    ["Ответ на согласовании", "ON_APPROVAL"],
  ])("статус письма «%s» → %s", (input, expected) => {
    expect(parseLetterStatus(input)).toBe(expected);
  });

  it("узнаёт статус, дописанный деталями", () => {
    expect(parseLetterStatus("На согласовании у Баринова А.Ю.")).toBe("ON_APPROVAL");
  });
});

describe("реестр подписания", () => {
  it("вытаскивает сторону из заголовка колонки", () => {
    expect(partyFromHeader("Статус подписания ДЖКХ")).toBe("ДЖКХ");
    expect(partyFromHeader("Статус ДИТ")).toBe("ДИТ");
  });

  it("не считает стороной общий статус строки", () => {
    expect(partyFromHeader("Статус согласования")).toBeNull();
    expect(partyFromHeader("Итоговый статус подписания")).toBeNull();
    expect(partyFromHeader("Тема")).toBeNull();
  });

  it.each([
    ["Подписан", "SIGNED"],
    ["Согласован", "SIGNED"],
    ["Нет", "PENDING"],
    ["Заслан", "PENDING"],
    ["Не согласован РСО", "DECLINED"],
  ])("статус стороны «%s» → %s", (input, expected) => {
    expect(parsePartyStatus(input)).toBe(expected);
  });

  it("распознаёт шапку реестра регламентов", () => {
    const columns = matchColumns(
      [
        "№", "РСО", "Статус ДИТ", "Статус подписания ДИТ", "Статус подписания РСО",
        "Статус подписания ДЖКХ", "Актуальный статус", "Актуальные задачи",
        "Ответственный", "Ссылка на ЭДО", "Итоговый статус подписания",
      ],
      DOCUMENT_COLUMNS,
    );
    const keys = [...columns.values()];
    expect(keys).toContain("counterparty");
    expect(keys).toContain("statusNote");
    expect(keys).toContain("finalStatus");
    expect(keys).toContain("nextAction");
  });

  it("узнаёт отказ в итоговой формулировке", () => {
    expect(isRefusalNote("Отказали в подписании, сославшись на секретность")).toBe(true);
    expect(isRefusalNote("Не согласован РСО")).toBe(true);
    expect(isRefusalNote("Подписан, экземпляр передан в РСО")).toBe(false);
    expect(isRefusalNote(null)).toBe(false);
  });
});

describe("статус документа по сторонам", () => {
  it("подписан, только когда подписали все обязательные стороны", () => {
    expect(
      deriveDocumentStatus(
        [{ status: "SIGNED" }, { status: "SIGNED" }, { status: "SIGNED" }],
        "DRAFT",
      ),
    ).toBe("SIGNED");
  });

  it("частично подписанный документ остаётся на подписании", () => {
    expect(
      deriveDocumentStatus([{ status: "SIGNED" }, { status: "PENDING" }], "DRAFT"),
    ).toBe("SIGNING");
  });

  it("отказ любой стороны блокирует документ", () => {
    expect(
      deriveDocumentStatus([{ status: "SIGNED" }, { status: "DECLINED" }], "DRAFT"),
    ).toBe("DECLINED");
  });

  it("необязательные стороны не учитываются", () => {
    expect(
      deriveDocumentStatus([{ status: "SIGNED" }, { status: "NOT_REQUIRED" }], "DRAFT"),
    ).toBe("SIGNED");
    expect(signatureProgress([{ status: "SIGNED" }, { status: "NOT_REQUIRED" }])).toBe(100);
  });

  it("без сторон статус не выводится и остаётся прежним", () => {
    expect(deriveDocumentStatus([], "REVIEW")).toBe("REVIEW");
  });
});

describe("поиск по переписке", () => {
  it("складывает поисковую строку в нижнем регистре без ё", () => {
    const index = buildSearchIndex(["64-01-16906/26", "Согласование ТЗ", "ДЖКХ", null]);
    expect(index).toBe("64-01-16906/26 согласование тз джкх");
  });

  it("запрос приводится к тому же виду, что и индекс", () => {
    expect(normalizeQuery("  Согласование   ТЗ ")).toBe("согласование тз");
    expect(normalizeQuery("Ёлка")).toBe("елка");
  });
});
