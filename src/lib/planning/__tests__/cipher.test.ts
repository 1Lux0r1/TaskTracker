import { describe, expect, it } from "vitest";
import {
  CIPHER_SETTINGS,
  CIPHER_SETTINGS_BOOK,
  CIPHER_SETTINGS_TZ,
  PLAN_CODE_PATTERN,
  PLAN_PART_CODE_PATTERN,
  PLAN_STAGE_CODE_PATTERN,
  buildCipher,
  cipherMsNumber,
  formatPlanNumber,
  msLabel,
  nextRepeat,
  stageWithRepeat,
} from "../cipher";

const book = { system: "RKII", direction: "TATep", part: "1", msSubsystem: "TA" };
const tz = { system: "RKII", direction: "Gaz", part: "Rte", dkSubsystem: "TA", msSubsystem: "TA" };

describe("шифр задачи плана: формат книги", () => {
  it("действует по умолчанию", () => {
    expect(CIPHER_SETTINGS).toBe(CIPHER_SETTINGS_BOOK);
  });

  it("воспроизводит пример книги RKII.TATep.1.1.TA.1.Р", () => {
    expect(buildCipher({ system: "RKII", direction: "TATep" })).toBe("RKII.TATep");
    expect(buildCipher({ ...book, dkNumber: 1 })).toBe("RKII.TATep.1.1");
    expect(buildCipher({ ...book, dkNumber: 1, msNumber: 50, msSubsystemNumber: 1, stage: "Р" })).toBe(
      "RKII.TATep.1.1.TA.1.Р",
    );
    expect(buildCipher({ ...book, dkNumber: 1, msNumber: 50, msSubsystemNumber: 1, stage: "Р", repeat: 3 })).toBe(
      "RKII.TATep.1.1.TA.1.Р3",
    );
  });

  it("задача по пункту без МС — без подсистемы", () => {
    expect(buildCipher({ ...book, msSubsystem: null, dkNumber: 4, stage: "БА" })).toBe("RKII.TATep.1.4.БА");
  });

  it("берёт номер МС внутри подсистемы и пишет номера без нулей", () => {
    expect(buildCipher({ ...book, part: "11", dkNumber: 12, msNumber: 8, msSubsystemNumber: 3, stage: "Экс" })).toBe(
      "RKII.TATep.11.12.TA.3.Экс",
    );
    expect(cipherMsNumber({ number: 8, subsystemNumber: 3 })).toBe(3);
    expect(msLabel({ number: 8, subsystemNumber: 3, subsystem: { code: "TA" } })).toBe("TA.3");
  });
});

describe("шифр задачи плана: формат ТЗ", () => {
  it("воспроизводит примеры из ТЗ", () => {
    expect(buildCipher({ ...tz, dkNumber: 1 }, CIPHER_SETTINGS_TZ)).toBe("RKII.Gaz.Rte.TA.01");
    expect(buildCipher({ ...tz, dkNumber: 1, stage: "БА" }, CIPHER_SETTINGS_TZ)).toBe("RKII.Gaz.Rte.TA.01.БА");
    expect(buildCipher({ ...tz, dkNumber: 1, msNumber: 8, msSubsystemNumber: 3, stage: "Р", repeat: 2 }, CIPHER_SETTINGS_TZ)).toBe(
      "RKII.Gaz.Rte.TA.01.08.Р2",
    );
    expect(msLabel({ number: 8, subsystemNumber: 3, subsystem: { code: "TA" } }, CIPHER_SETTINGS_TZ)).toBe("08");
  });

  it("не пишет номер у первой задачи этапа", () => {
    expect(buildCipher({ ...tz, dkNumber: 1, msNumber: 8, stage: "СА", repeat: 1 }, CIPHER_SETTINGS_TZ)).toBe(
      "RKII.Gaz.Rte.TA.01.08.СА",
    );
    expect(stageWithRepeat("Т", 3)).toBe("Т3");
    expect(stageWithRepeat("Т", null)).toBe("Т");
  });

  it("опускает неизвестные позиции", () => {
    expect(buildCipher({ ...tz, dkSubsystem: null, dkNumber: 2, stage: "Арх" }, CIPHER_SETTINGS_TZ)).toBe(
      "RKII.Gaz.Rte.02.Арх",
    );
    expect(buildCipher({ system: "RKII", direction: " ", part: "Rte" })).toBe("RKII.Rte");
  });

  it("пишет номер двумя знаками, после 99 — тремя", () => {
    expect(formatPlanNumber(8, 2)).toBe("08");
    expect(formatPlanNumber(100, 2)).toBe("100");
    expect(formatPlanNumber(8, 1)).toBe("8");
    expect(buildCipher({ ...tz, dkNumber: 12, msNumber: 104, stage: "DO" }, CIPHER_SETTINGS_TZ)).toBe(
      "RKII.Gaz.Rte.TA.12.104.DO",
    );
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

  it("код части может быть номером раздела ОФТ", () => {
    expect(PLAN_PART_CODE_PATTERN.test("14")).toBe(true);
    expect(PLAN_PART_CODE_PATTERN.test("Rte")).toBe(true);
    expect(PLAN_PART_CODE_PATTERN.test("1.1")).toBe(false);
  });

  it("код этапа — только буквы, иначе спутается с повтором", () => {
    expect(PLAN_STAGE_CODE_PATTERN.test("Внед")).toBe(true);
    expect(PLAN_STAGE_CODE_PATTERN.test("DO")).toBe(true);
    expect(PLAN_STAGE_CODE_PATTERN.test("Р2")).toBe(false);
  });
});
