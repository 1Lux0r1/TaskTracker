import { describe, expect, it } from "vitest";
import {
  PRESET_NAME_LIMIT,
  cleanPresetName,
  isFilterScope,
  noPresetHref,
  presetHref,
  presetQuery,
  scopeHref,
  shouldApplyDefault,
} from "@/lib/filter-presets";

describe("presetQuery", () => {
  it("выбрасывает пустые поля и сам набор", () => {
    expect(presetQuery("preset=overdue&status=&set=abc&q=россети")).toBe(
      "preset=overdue&q=%D1%80%D0%BE%D1%81%D1%81%D0%B5%D1%82%D0%B8",
    );
  });

  it("один и тот же отбор даёт одну и ту же строку", () => {
    expect(presetQuery("sort=dueAsc&preset=open")).toBe(presetQuery("preset=open&sort=dueAsc"));
  });

  it("пустой отбор — пустая строка", () => {
    expect(presetQuery("")).toBe("");
    expect(presetQuery("set=abc")).toBe("");
  });
});

describe("presetHref", () => {
  it("к условиям набора добавляет сам набор", () => {
    expect(presetHref("/letters", "preset=overdue", "abc")).toBe(
      "/letters?preset=overdue&set=abc",
    );
  });

  it("набор без условий всё равно виден в адресе", () => {
    expect(presetHref("/tasks", "", "xyz")).toBe("/tasks?set=xyz");
  });

  it("снятый набор не даёт набору по умолчанию вернуться", () => {
    const href = noPresetHref("/documents");
    expect(href).toBe("/documents?set=none");
    expect(shouldApplyDefault({ set: "none" })).toBe(false);
  });
});

describe("shouldApplyDefault", () => {
  it("набор по умолчанию применяется только на чистом адресе", () => {
    expect(shouldApplyDefault({})).toBe(true);
    expect(shouldApplyDefault({ preset: "open" })).toBe(false);
  });
});

describe("cleanPresetName", () => {
  it("прибирает имя и не даёт ему разрастись", () => {
    expect(cleanPresetName("  Мои   просроченные ")).toBe("Мои просроченные");
    expect(cleanPresetName("   ")).toBe("");
    expect(cleanPresetName("я".repeat(80))).toHaveLength(PRESET_NAME_LIMIT);
  });
});

describe("scopeHref", () => {
  it("знает реестры и не верит чужому значению", () => {
    expect(scopeHref("LETTER")).toBe("/letters");
    expect(isFilterScope("MEETING")).toBe(true);
    expect(isFilterScope("PROJECT")).toBe(false);
  });
});
