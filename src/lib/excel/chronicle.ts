import type { TaskStatus } from "@/lib/domain";
import { parseStatus } from "@/lib/excel/columns";

export type ChronicleEntry = { occurredOn: Date | null; body: string };

/**
 * В исходных реестрах колонка «Статус» — не состояние, а журнал:
 * «05.05.2026 драфт письма загружен в ЭДО\n06.05.2026 на согласовании у Ежовой».
 * Наивный импорт положил бы это в статус и потерял бы самое ценное в файле.
 */
const LEADING_DATE = /^\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\s*[-–—:]?\s*/;
const TRAILING_DATE = /\s+(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\s*$/;

export function parseChronicle(raw: string): ChronicleEntry[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const leading = LEADING_DATE.exec(line);
      if (leading) {
        return {
          occurredOn: toDate(leading[1], leading[2], leading[3]),
          body: stripLeadingPunctuation(line.slice(leading[0].length)),
        };
      }
      const trailing = TRAILING_DATE.exec(line);
      if (trailing) {
        return {
          occurredOn: toDate(trailing[1], trailing[2], trailing[3]),
          body: line.slice(0, trailing.index).trim(),
        };
      }
      return { occurredOn: null, body: line };
    })
    .filter((entry) => entry.body.length > 0);
}

/**
 * Статус задачи по журналу: справочное значение, если строка им и является,
 * иначе «Выполнено …» закрывает задачу, а любой другой текст означает работу.
 */
export function inferStatusFromChronicle(raw: string, entries: ChronicleEntry[]): TaskStatus {
  const exact = parseStatus(raw);
  if (exact) return exact;

  const latest = entries[entries.length - 1]?.body ?? raw;
  const prefixStatus = parseStatus(latest.split(/[\s,.]/, 1)[0]);
  if (prefixStatus) return prefixStatus;

  return entries.length > 0 ? "IN_PROGRESS" : "TODO";
}

/** Дата закрытия — дата последней записи, если задача закрыта журналом. */
export function completionDate(entries: ChronicleEntry[]): Date | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.occurredOn && parseStatus(entry.body.split(/[\s,.]/, 1)[0]) === "DONE") {
      return entry.occurredOn;
    }
  }
  return null;
}

/** После вырезанной даты часто остаётся хвост пунктуации: «15.11.2025, замечаний нет». */
function stripLeadingPunctuation(value: string): string {
  return value.replace(/^[\s,;:–—-]+/, "").trim();
}

function toDate(day: string, month: string, year: string): Date | null {
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  const date = new Date(fullYear, Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}
