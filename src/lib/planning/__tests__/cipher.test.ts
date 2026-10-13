import { describe, expect, it } from "vitest";
import {
  CIPHER_SETTINGS_SUBSYSTEM_FROM_MS,
  PLAN_CODE_PATTERN,
  PLAN_STAGE_CODE_PATTERN,
  buildCipher,
  formatPlanNumber,
  nextRepeat,
  stageWithRepeat,
} from "../cipher";

const base = { system: "RKII", direction: "Gaz", part: "Rte", dkSubsystem: "TA", msSubsystem: "TA" };

describe("шифр задачи плана", () => {
  it("воспроизводит примеры из методики", () => {
    expect(buildCipher({ system: "RKII", direction: "Gaz" })).toBe("RKII.Gaz");
    expect(buildCipher({ system: "RKII", direction: "Gaz", part: "Rte" })).toBe("RKII.Gaz.Rte");
    expect(buildCipher({ ...base, dkNumber: 1 })).toBe("RKII.Gaz.Rte.TA.01");
    expect(buildCipher({ ...base, dkNumber: 1, stage: "БА" })).toBe("RKII.Gaz.Rte.TA.01.БА");
    expect(buildCipher({ ...base, dkNumber: 1, msNumber: 8, stage: "Р" })).toBe(
      "RKII.Gaz.Rte.TA.01.08.Р",
    );
    expect(buildCipher({ ...base, dkNumber: 1, msNumber: 8, stage: "Р", repeat: 2 })).toBe(
      "RKII.Gaz.Rte.TA.01.08.Р2",
    );
  });

  it("не пишет номер у первой задачи этапа", () => {
    expect(buildCipher({ ...base, dkNumber: 1, msNumber: 8, stage: "СА", repeat: 1 })).toBe(
      "RKII.Gaz.Rte.TA.01.08.СА",
    );
    expect(stageWithRepeat("Т", 3)).toBe("Т3");
    expect(stageWithRepeat("Т", null)).toBe("Т");
  });

  it("опускает неизвестные позиции", () => {
    expect(buildCipher({ ...base, dkSubsystem: null, dkNumber: 2, stage: "Арх" })).toBe(
      "RKII.Gaz.Rte.02.Арх",
    );
    expect(buildCipher({ system: "RKII", direction: " ", part: "Rte" })).toBe("RKII.Rte");
  });

  it("пишет номер двумя знаками, после 99 — тремя", () => {
    expect(formatPlanNumber(8)).toBe("08");
    expect(formatPlanNumber(99)).toBe("99");
    expect(formatPlanNumber(100)).toBe("100");
    expect(buildCipher({ ...base, dkNumber: 12, msNumber: 104, stage: "DO" })).toBe(
      "RKII.Gaz.Rte.TA.12.104.DO",
    );
  });

  it("меняет формат одной настройкой: подсистема из МС после ДК", () => {
    const input = { ...base, dkSubsystem: "XX", dkNumber: 1, msNumber: 8, stage: "Р" };
    expect(buildCipher(input, CIPHER_SETTINGS_SUBSYSTEM_FROM_MS)).toBe("RKII.Gaz.Rte.01.TA.08.Р");
  });
});

describe("номер повтора", () => {
  it("после Р и Р2 предлагает Р3", () => {
    expect(nextRepeat([1, 2])).toBe(3);
  });

  it("первая задача этапа получает 1, то есть без номера", () => {
    expect(nextRepeat([])).toBe(1);
  });

  it("идёт от максимума, а не заполняет пропуск", () => {
    expect(nextRepeat([1, 3])).toBe(4);
  });
});

describe("коды справочников", () => {
  it("не пускают точку и пробел", () => {
    expect(PLAN_CODE_PATTERN.test("Gaz")).toBe(true);
    expect(PLAN_CODE_PATTERN.test("Ga.z")).toBe(false);
    expect(PLAN_CODE_PATTERN.test("Ga z")).toBe(false);
    expect(PLAN_CODE_PATTERN.test("01")).toBe(false);
  });

  it("код этапа — только буквы, иначе спутается с повтором", () => {
    expect(PLAN_STAGE_CODE_PATTERN.test("Внед")).toBe(true);
    expect(PLAN_STAGE_CODE_PATTERN.test("DO")).toBe(true);
    expect(PLAN_STAGE_CODE_PATTERN.test("Р2")).toBe(false);
  });
});
