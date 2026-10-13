/**
 * Генератор шифра задачи плана — единственное место, где шифр собирается.
 *
 * Формат: СИСТЕМА.НАПРАВЛЕНИЕ.ЧАСТЬ.ПОДСИСТЕМА.ДК.МС.ЭТАП. Позиции
 * дописываются по мере готовности, неизвестные опускаются:
 *   RKII.Gaz                    — ОФТ направления
 *   RKII.Gaz.Rte                — блок
 *   RKII.Gaz.Rte.TA.01          — ДК
 *   RKII.Gaz.Rte.TA.01.БА       — БА по ДК
 *   RKII.Gaz.Rte.TA.01.08.Р     — разработка по МС 08
 *   RKII.Gaz.Rte.TA.01.08.Р2    — возврат, повтор разработки
 *
 * Открытое решение заказчика: подсистема может уйти из ДК и браться из МС
 * (RKII.Gaz.Rte.01.TA.08.Р). Смена формата — правка CIPHER_SETTINGS ниже,
 * после неё шифры пересобираются кнопкой в справочниках модуля.
 */

export type CipherSegment = "system" | "direction" | "part" | "subsystem" | "dk" | "ms" | "stage";

export type CipherSettings = {
  /** Порядок сегментов слева направо. */
  segments: CipherSegment[];
  /** Откуда берётся подсистема: из ДК (утверждено) или из МС. */
  subsystemSource: "dk" | "ms";
  separator: string;
};

/** Утверждённый формат: …ЧАСТЬ.ПОДСИСТЕМА.ДК.МС.ЭТАП, подсистема у ДК. */
export const CIPHER_SETTINGS: CipherSettings = {
  segments: ["system", "direction", "part", "subsystem", "dk", "ms", "stage"],
  subsystemSource: "dk",
  separator: ".",
};

/** Вариант, который рассматривает заказчик: подсистема из МС, после ДК. */
export const CIPHER_SETTINGS_SUBSYSTEM_FROM_MS: CipherSettings = {
  segments: ["system", "direction", "part", "dk", "subsystem", "ms", "stage"],
  subsystemSource: "ms",
  separator: ".",
};

export type CipherInput = {
  system?: string | null;
  direction?: string | null;
  part?: string | null;
  /** Подсистема, указанная у ДК. */
  dkSubsystem?: string | null;
  /** Подсистема МС. */
  msSubsystem?: string | null;
  dkNumber?: number | null;
  msNumber?: number | null;
  stage?: string | null;
  /** 1 — первая задача этапа, номер не пишется; 2 и дальше — повторы. */
  repeat?: number | null;
};

/** Номер ДК и МС — два знака, после 99 — три: 01, 08, 99, 100. */
export function formatPlanNumber(value: number): string {
  return String(value).padStart(2, "0");
}

/** Код этапа с номером повтора: Р, Р2, Р3. Номер пишется только у повторов. */
export function stageWithRepeat(stage: string, repeat: number | null | undefined): string {
  return repeat && repeat > 1 ? `${stage}${repeat}` : stage;
}

export function buildCipher(input: CipherInput, settings: CipherSettings = CIPHER_SETTINGS): string {
  const subsystem = settings.subsystemSource === "dk" ? input.dkSubsystem : input.msSubsystem;

  const values: Record<CipherSegment, string | null> = {
    system: clean(input.system),
    direction: clean(input.direction),
    part: clean(input.part),
    subsystem: clean(subsystem),
    dk: input.dkNumber ? formatPlanNumber(input.dkNumber) : null,
    ms: input.msNumber ? formatPlanNumber(input.msNumber) : null,
    stage: clean(input.stage) ? stageWithRepeat(clean(input.stage)!, input.repeat) : null,
  };

  return settings.segments
    .map((segment) => values[segment])
    .filter((value): value is string => Boolean(value))
    .join(settings.separator);
}

/**
 * Следующий номер повтора этапа: после Р и Р2 — 3. Берётся максимум, а не
 * первая дыра: повтор — это очередной возврат, а не заполнение пропуска.
 */
export function nextRepeat(existing: number[]): number {
  if (existing.length === 0) return 1;
  return Math.max(...existing) + 1;
}

/**
 * Код справочника для шифра: буквы и цифры, начинается с буквы. Точка —
 * разделитель шифра, поэтому в коде её быть не может.
 */
export const PLAN_CODE_PATTERN = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9]*$/;

/**
 * Код этапа — только буквы: цифра в конце читалась бы как номер повтора
 * (Р2 — повтор этапа «Р», а не этап «Р2»).
 */
export const PLAN_STAGE_CODE_PATTERN = /^[A-Za-zА-Яа-яЁё]+$/;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
