/**
 * Разбор книги «Планирование развития системы»: справочники подсистем, МС,
 * этапов, направлений и частей. Книги пока нет на руках, поэтому разбор не
 * привязан к адресам ячеек: на каждом листе ищутся строки-шапки по словам в
 * подписях колонок, под шапкой читаются строки до первой пустой. Что
 * опознано и что нет, скрипт печатает до записи в базу.
 */

export type Cell = string | number | Date | null;
export type BookSheet = { name: string; rows: Cell[][] };

export type BookData = {
  subsystems: { code: string; name: string }[];
  modules: { number: number; name: string; subsystem: string; version: string | null }[];
  stages: { code: string; name: string; level: "DK" | "DK_OR_MS" | "MS" }[];
  directions: {
    code: string;
    name: string;
    goal: string | null;
    deadline: Date | null;
    priority: "MAIN" | "SUPPORT" | "DEFERRED";
    decisionDate: Date | null;
    decisionBasis: string | null;
    oftApprovedAt: Date | null;
  }[];
  parts: { direction: string; code: string; name: string }[];
  /** Что найдено и где: печатается при пробном прогоне. */
  found: string[];
};

type Column =
  | "code"
  | "name"
  | "subsystem"
  | "ms"
  | "version"
  | "level"
  | "stage"
  | "direction"
  | "part"
  | "goal"
  | "deadline"
  | "priority"
  | "decisionDate"
  | "decisionBasis"
  | "oft";

/** Подпись колонки → смысл. Порядок важен: первое совпадение побеждает. */
const HEADERS: [RegExp, Column][] = [
  [/^код/i, "code"],
  [/^(назв|наимен)/i, "name"],
  [/офт/i, "oft"],
  [/дата.*решени/i, "decisionDate"],
  [/основани/i, "decisionBasis"],
  [/цел/i, "goal"],
  [/приоритет/i, "priority"],
  [/срок/i, "deadline"],
  [/верси/i, "version"],
  [/уровен/i, "level"],
  [/(№|номер|ном\.).*мс|^мс$|^№\s*мс/i, "ms"],
  [/подсистем/i, "subsystem"],
  [/част/i, "part"],
  [/направлени/i, "direction"],
  [/этап/i, "stage"],
  [/шифр/i, "code"],
  [/назв|наимен|микросервис|сервис/i, "name"],
];

function text(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

function classify(label: string): Column | null {
  for (const [pattern, column] of HEADERS) if (pattern.test(label)) return column;
  return null;
}

function asDate(cell: Cell | undefined): Date | null {
  if (cell instanceof Date) return new Date(cell.getFullYear(), cell.getMonth(), cell.getDate());
  const match = text(cell).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
}

export function stageLevel(value: string): "DK" | "DK_OR_MS" | "MS" {
  const v = value.toUpperCase();
  const dk = v.includes("ДК");
  const ms = v.includes("МС") || v.includes("MS");
  if (dk && ms) return "DK_OR_MS";
  return dk ? "DK" : "MS";
}

export function priorityOf(value: string): "MAIN" | "SUPPORT" | "DEFERRED" {
  const v = value.toLowerCase();
  if (v.startsWith("обесп")) return "SUPPORT";
  if (v.startsWith("отлож")) return "DEFERRED";
  return "MAIN";
}

/** Шапка: строка, где опознано не меньше двух колонок. */
function headerOf(row: Cell[]): Map<Column, number> | null {
  const map = new Map<Column, number>();
  row.forEach((cell, index) => {
    const column = classify(text(cell));
    if (column && !map.has(column)) map.set(column, index);
  });
  return map.size >= 2 ? map : null;
}

export function parseBook(sheets: BookSheet[]): BookData {
  const data: BookData = { subsystems: [], modules: [], stages: [], directions: [], parts: [], found: [] };

  for (const sheet of sheets) {
    for (let r = 0; r < sheet.rows.length; r += 1) {
      const header = headerOf(sheet.rows[r]);
      if (!header) continue;
      const labels = sheet.rows[r].map(text).join(" ");
      const kind = tableKind(header, sheet.name, labels);
      if (!kind) continue;

      const get = (row: Cell[], column: Column) =>
        header.has(column) ? row[header.get(column)!] : undefined;
      let count = 0;
      let i = r + 1;
      for (; i < sheet.rows.length; i += 1) {
        const row = sheet.rows[i];
        if (row.every((cell) => text(cell) === "")) break;
        if (headerOf(row)) break;
        if (readRow(kind, row, get, data)) count += 1;
      }
      data.found.push(`«${sheet.name}», строка ${r + 1}: ${KIND_LABELS[kind]} — ${count}`);
      r = i - 1;
    }
  }
  return data;
}

type Kind = "modules" | "stages" | "parts" | "directions" | "subsystems";

const KIND_LABELS: Record<Kind, string> = {
  modules: "МС",
  stages: "этапы",
  parts: "части направлений",
  directions: "направления",
  subsystems: "подсистемы",
};

function tableKind(header: Map<Column, number>, sheet: string, labels: string): Kind | null {
  if (header.has("ms") && header.has("name")) return "modules";
  if (header.has("level")) return "stages";
  if (header.has("direction") && /част/i.test(labels)) return "parts";
  if (header.has("goal") || header.has("priority") || header.has("oft")) return "directions";
  if (/подсистем/i.test(labels) && (header.has("code") || header.has("name"))) return "subsystems";
  if (/направлени/i.test(sheet) && header.has("code") && header.has("name")) return "directions";
  return null;
}

function readRow(
  kind: Kind,
  row: Cell[],
  get: (row: Cell[], column: Column) => Cell | undefined,
  data: BookData,
): boolean {
  switch (kind) {
    case "modules": {
      const number = Number(text(get(row, "ms")));
      const name = text(get(row, "name"));
      if (!Number.isInteger(number) || number < 1 || !name) return false;
      data.modules.push({
        number,
        name,
        subsystem: text(get(row, "subsystem")),
        version: text(get(row, "version")) || null,
      });
      return true;
    }
    case "stages": {
      const code = text(get(row, "code") ?? get(row, "stage"));
      if (!code) return false;
      data.stages.push({
        code,
        name: text(get(row, "name")) || code,
        level: stageLevel(text(get(row, "level"))),
      });
      return true;
    }
    case "parts": {
      const direction = text(get(row, "direction"));
      const code = text(get(row, "code") ?? get(row, "part"));
      if (!direction || !code) return false;
      data.parts.push({ direction, code, name: text(get(row, "name")) || code });
      return true;
    }
    case "subsystems": {
      // Подпись «Подсистема» без «Код» — это колонка кода подсистемы.
      const code = text(get(row, "code") ?? get(row, "subsystem"));
      const name = text(get(row, "name"));
      if (!code) return false;
      data.subsystems.push({ code, name: name || code });
      return true;
    }
    case "directions": {
      const code = text(get(row, "code") ?? get(row, "direction"));
      if (!code) return false;
      data.directions.push({
        code,
        name: text(get(row, "name") ?? get(row, "direction")) || code,
        goal: text(get(row, "goal")) || null,
        deadline: asDate(get(row, "deadline")),
        priority: priorityOf(text(get(row, "priority"))),
        decisionDate: asDate(get(row, "decisionDate")),
        decisionBasis: text(get(row, "decisionBasis")) || null,
        oftApprovedAt: asDate(get(row, "oft")),
      });
      return true;
    }
  }
}
