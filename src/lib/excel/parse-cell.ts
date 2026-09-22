import type { CellValue } from "exceljs";

/** Разворачивает ячейку ExcelJS (формулы, rich text, гиперссылки) в примитив. */
export function cellValue(value: CellValue): string | number | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "да" : "нет";

  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellValue(value.result as CellValue);
    if ("error" in value) return null;
  }
  return null;
}

export function cellText(value: CellValue): string | null {
  const parsed = cellValue(value);
  if (parsed === null) return null;
  if (parsed instanceof Date) return parsed.toISOString().slice(0, 10);
  const text = String(parsed).trim();
  return text.length === 0 ? null : text;
}

export function cellNumber(value: CellValue): number | null {
  const parsed = cellValue(value);
  if (parsed === null || parsed instanceof Date) return null;
  if (typeof parsed === "number") return Number.isFinite(parsed) ? parsed : null;
  const normalized = parsed.replace(/\s/g, "").replace("%", "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

const DMY = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/;
const YMD = /^(\d{4})-(\d{1,2})-(\d{1,2})/;

/**
 * Дата из ячейки. Кроме настоящих дат разбирает текстовые «01.02.2026»,
 * «2026-02-01» и серийные номера Excel (эпоха 1900 с багом високосного года).
 */
export function cellDate(value: CellValue): Date | null {
  const parsed = cellValue(value);
  if (parsed === null) return null;

  if (parsed instanceof Date) {
    return Number.isNaN(parsed.getTime()) ? null : stripTime(parsed);
  }

  if (typeof parsed === "number") {
    if (parsed < 1 || parsed > 2_958_465) return null;
    const days = parsed > 59 ? parsed - 1 : parsed;
    const millis = Date.UTC(1900, 0, 1) + (days - 1) * 86_400_000;
    return stripTime(new Date(millis));
  }

  const text = parsed.trim();
  const dmy = DMY.exec(text);
  if (dmy) {
    const [, day, month, year] = dmy;
    const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
    const date = new Date(fullYear, Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const ymd = YMD.exec(text);
  if (ymd) {
    const [, year, month, day] = ymd;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function stripTime(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
