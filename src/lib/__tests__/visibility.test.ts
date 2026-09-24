import { describe, expect, it } from "vitest";
import {
  VISIBILITY_DEFAULTS,
  readVisibility,
  visibilityEntityHref,
  visibilityEntityLabel,
  visibilityLabel,
  visibilityValue,
} from "@/lib/visibility";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("readVisibility", () => {
  it("читает выбор из формы", () => {
    expect(readVisibility(form({ visibility: "PUBLIC" }))).toBe(true);
    expect(readVisibility(form({ visibility: "INTERNAL" }))).toBe(false);
  });

  it("поля в форме нет — видимость не меняется", () => {
    // Участнику после создания записи поле не показывают, и тогда решение
    // принимать не из чего: null означает «оставить как есть».
    expect(readVisibility(form({ title: "Задача" }))).toBeNull();
    expect(readVisibility(form({ visibility: "что-то своё" }))).toBeNull();
  });
});

describe("значения по умолчанию", () => {
  it("работа проекта публичная, переписка служебная", () => {
    expect(VISIBILITY_DEFAULTS.TASK).toBe(true);
    expect(VISIBILITY_DEFAULTS.DOCUMENT).toBe(true);
    expect(VISIBILITY_DEFAULTS.LETTER).toBe(false);
  });
});

describe("подписи", () => {
  it("называет видимость по-русски", () => {
    expect(visibilityLabel(true)).toBe("Публичная");
    expect(visibilityLabel(false)).toBe("Служебная");
    expect(visibilityValue(false)).toBe("INTERNAL");
  });

  it("ведёт из журнала к записи", () => {
    expect(visibilityEntityLabel("LETTER")).toBe("Письмо");
    expect(visibilityEntityHref("LETTER", "abc")).toBe("/letters/abc");
    expect(visibilityEntityHref("MEETING", "abc")).toBeNull();
  });
});
