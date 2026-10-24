/**
 * Генератор шифра задачи плана — единственное место, где шифр собирается.
 *
 * Формат книги планирования (с 24.10.2026, утверждён по книге заказчика):
 * СИСТЕМА.НАПРАВЛЕНИЕ.РАЗДЕЛ.ПУНКТ.ПОДСИСТЕМА.МС.ЭТАП, номера без нулей,
 * подсистема — та, где живёт МС, номер МС — внутри подсистемы:
 *   RKII.TATep                  — направление ОФТ
 *   RKII.TATep.1                — раздел ОФТ (в модели — часть, блок)
 *   RKII.TATep.1.1              — пункт дорожной карты (ДК)
 *   RKII.TATep.1.1.БА           — БА по пункту, без МС
 *   RKII.TATep.1.1.TA.1.Р       — разработка по МС TA.1
 *   RKII.TATep.1.1.TA.1.Р2      — возврат, повтор разработки
 *
 * Прежний формат из ТЗ 13.10 (…ЧАСТЬ.ПОДСИСТЕМА.ДК.МС.ЭТАП, подсистема у ДК,
 * сквозной номер МС, два знака) сохранён как CIPHER_SETTINGS_TZ. Смена
 * формата — правка CIPHER_SETTINGS ниже, после неё шифры пересобираются
 * кнопкой в справочниках модуля.
 */

export type CipherSegment = "system" | "direction" | "part" | "subsystem" | "dk" | "ms" | "stage";

export type CipherSettings = {
  /** Порядок сегментов слева направо. */
  segments: CipherSegment[];
  /** Откуда берётся подсистема: из ДК или из МС. */
  subsystemSource: "dk" | "ms";
  /** Какой номер МС стоит в шифре: сквозной по реестру или внутри подсистемы. */
  msNumber: "registry" | "subsystem";
  /** Сколько знаков у номеров ДК и МС: 2 — 01, 08; 1 — без ведущих нулей. */
  numberWidth: number;
  separator: string;
};

/** Формат книги планирования: подсистема и номер МС — из МС, без нулей. */
export const CIPHER_SETTINGS_BOOK: CipherSettings = {
  segments: ["system", "direction", "part", "dk", "subsystem", "ms", "stage"],
  subsystemSource: "ms",
  msNumber: "subsystem",
  numberWidth: 1,
  separator: ".",
};

/** Формат ТЗ 13.10: …ЧАСТЬ.ПОДСИСТЕМА.ДК.МС.ЭТАП, подсистема у ДК. */
export const CIPHER_SETTINGS_TZ: CipherSettings = {
  segments: ["system", "direction", "part", "subsystem", "dk", "ms", "stage"],
  subsystemSource: "dk",
  msNumber: "registry",
  numberWidth: 2,
  separator: ".",
};

/** Действующий формат. */
export const CIPHER_SETTINGS: CipherSettings = CIPHER_SETTINGS_BOOK;

export type CipherInput = {
  system?: string | null;
  direction?: string | null;
  part?: string | null;
  /** Подсистема, указанная у ДК. */
  dkSubsystem?: string | null;
  /** Подсистема МС. */
  msSubsystem?: string | null;
  dkNumber?: number | null;
  /** Сквозной номер МС в реестре системы. */
  msNumber?: number | null;
  /** Номер МС внутри его подсистемы. */
  msSubsystemNumber?: number | null;
  stage?: string | null;
  /** 1 — первая задача этапа, номер не пишется; 2 и дальше — повторы. */
  repeat?: number | null;
};

/** Номер ДК и МС в действующем формате: 1 или 01; после 99 — три знака. */
export function formatPlanNumber(value: number, width: number = CIPHER_SETTINGS.numberWidth): string {
  return String(value).padStart(width, "0");
}

/** Код этапа с номером повтора: Р, Р2, Р3. Номер пишется только у повторов. */
export function stageWithRepeat(stage: string, repeat: number | null | undefined): string {
  return repeat && repeat > 1 ? `${stage}${repeat}` : stage;
}

/** Номер МС, который идёт в шифр при данных настройках. */
export function cipherMsNumber(
  ms: { number: number; subsystemNumber: number | null } | null | undefined,
  settings: CipherSettings = CIPHER_SETTINGS,
): number | null {
  if (!ms) return null;
  return settings.msNumber === "subsystem" ? ms.subsystemNumber : ms.number;
}

/** Подпись МС в списках: подсистема и номер так, как они стоят в шифре. */
export function msLabel(
  ms: { number: number; subsystemNumber: number | null; subsystem: { code: string } },
  settings: CipherSettings = CIPHER_SETTINGS,
): string {
  const number = cipherMsNumber(ms, settings);
  if (settings.msNumber === "subsystem") {
    return `${ms.subsystem.code}.${number ?? "?"}`;
  }
  return formatPlanNumber(ms.number, settings.numberWidth);
}

export function buildCipher(input: CipherInput, settings: CipherSettings = CIPHER_SETTINGS): string {
  const msNumber = settings.msNumber === "subsystem" ? input.msSubsystemNumber : input.msNumber;
  // Подсистема из МС пишется только вместе с номером МС: без МС её нет.
  const subsystem = settings.subsystemSource === "dk" ? input.dkSubsystem : msNumber ? input.msSubsystem : null;
  const number = (value: number | null | undefined) =>
    value ? formatPlanNumber(value, settings.numberWidth) : null;

  const values: Record<CipherSegment, string | null> = {
    system: clean(input.system),
    direction: clean(input.direction),
    part: clean(input.part),
    subsystem: clean(subsystem),
    dk: number(input.dkNumber),
    ms: number(msNumber),
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
 * Код части (раздела ОФТ): в книге это номер раздела — 1, 2, 14, — поэтому
 * можно и одни цифры. Точки и пробелы по-прежнему нельзя.
 */
export const PLAN_PART_CODE_PATTERN = /^[A-Za-zА-Яа-яЁё0-9]+$/;

/**
 * Код этапа — только буквы: цифра в конце читалась бы как номер повтора
 * (Р2 — повтор этапа «Р», а не этап «Р2»).
 */
export const PLAN_STAGE_CODE_PATTERN = /^[A-Za-zА-Яа-яЁё]+$/;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
