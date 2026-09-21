import type { TaskPriority, TaskStatus } from "@/lib/domain";

/**
 * Описание колонки таблицы задач: заголовок в файле, ширина при экспорте
 * и список синонимов, которые встречаются в реальных Excel-файлах.
 */
export type TaskColumn = {
  key: string;
  header: string;
  width: number;
  aliases: string[];
};

export const TASK_COLUMNS: TaskColumn[] = [
  { key: "externalKey", header: "ID", width: 14, aliases: ["id", "ключ", "код", "номер", "№", "n", "no"] },
  { key: "title", header: "Задача", width: 46, aliases: ["задача", "название", "наименование", "работа", "тема", "title", "task", "name"] },
  { key: "description", header: "Описание", width: 46, aliases: ["описание", "комментарий", "примечание", "детали", "description", "notes"] },
  { key: "status", header: "Статус", width: 16, aliases: ["статус", "состояние", "этап", "status", "state"] },
  { key: "priority", header: "Приоритет", width: 14, aliases: ["приоритет", "важность", "priority"] },
  { key: "assignee", header: "Ответственный", width: 26, aliases: ["ответственный", "исполнитель", "ответственные", "кто", "assignee", "owner", "responsible"] },
  { key: "startDate", header: "Начало", width: 14, aliases: ["начало", "дата начала", "старт", "start", "start date"] },
  { key: "dueDate", header: "Срок", width: 14, aliases: ["срок", "дедлайн", "дата окончания", "окончание", "план", "due", "due date", "deadline", "finish"] },
  { key: "estimateHours", header: "Оценка, ч", width: 12, aliases: ["оценка", "оценка, ч", "план часов", "трудоёмкость", "трудоемкость", "estimate", "estimate hours"] },
  { key: "spentHours", header: "Факт, ч", width: 12, aliases: ["факт", "факт, ч", "потрачено", "затрачено", "spent", "actual"] },
  { key: "progress", header: "Готовность, %", width: 14, aliases: ["готовность", "готовность, %", "прогресс", "процент", "% выполнения", "progress", "complete"] },
];

/** Приводит заголовок из файла к виду, по которому ищем синоним. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\s._-]+/g, " ")
    .trim();
}

/**
 * Сопоставляет заголовки листа с полями задачи: { columnIndex -> key }.
 *
 * Два прохода: сначала точные совпадения, затем вхождение синонима в заголовок
 * («Наименование работы» → «наименование»). Точные важнее, поэтому идут первыми,
 * иначе длинный заголовок перехватил бы колонку у своего настоящего владельца.
 */
export function matchColumns(headerRow: unknown[]): Map<number, string> {
  const result = new Map<number, string>();
  const taken = new Set<string>();
  const headers = headerRow.map((raw) => normalizeHeader(raw));

  headers.forEach((normalized, index) => {
    if (!normalized) return;
    const column = TASK_COLUMNS.find(
      (candidate) =>
        !taken.has(candidate.key) &&
        (normalizeHeader(candidate.header) === normalized ||
          candidate.aliases.includes(normalized)),
    );
    if (column) {
      result.set(index, column.key);
      taken.add(column.key);
    }
  });

  headers.forEach((normalized, index) => {
    if (!normalized || result.has(index)) return;
    const column = TASK_COLUMNS.filter((candidate) => !taken.has(candidate.key))
      .flatMap((candidate) =>
        candidate.aliases
          .filter((alias) => alias.length >= 4 && containsWord(normalized, alias))
          .map((alias) => ({ candidate, length: alias.length })),
      )
      // Более длинный синоним конкретнее: «дата начала» точнее, чем «дата».
      .sort((a, b) => b.length - a.length)[0]?.candidate;

    if (column) {
      result.set(index, column.key);
      taken.add(column.key);
    }
  });

  return result;
}

/** Синоним должен стоять в заголовке отдельным словом, а не частью другого. */
function containsWord(header: string, alias: string): boolean {
  const index = header.indexOf(alias);
  if (index < 0) return false;
  const before = index === 0 ? " " : header[index - 1];
  const after = header[index + alias.length] ?? " ";
  return before === " " && (after === " " || after === "," || after === ":");
}

const STATUS_SYNONYMS: Record<string, TaskStatus> = {
  "бэклог": "BACKLOG",
  "беклог": "BACKLOG",
  "идея": "BACKLOG",
  "backlog": "BACKLOG",
  "к выполнению": "TODO",
  "новая": "TODO",
  "новый": "TODO",
  "не начата": "TODO",
  "запланировано": "TODO",
  "открыта": "TODO",
  "todo": "TODO",
  "open": "TODO",
  "в работе": "IN_PROGRESS",
  "выполняется": "IN_PROGRESS",
  "в процессе": "IN_PROGRESS",
  "in progress": "IN_PROGRESS",
  "doing": "IN_PROGRESS",
  "на проверке": "REVIEW",
  "проверка": "REVIEW",
  "на согласовании": "REVIEW",
  "review": "REVIEW",
  "готово": "DONE",
  "выполнена": "DONE",
  "выполнено": "DONE",
  "завершена": "DONE",
  "закрыта": "DONE",
  "done": "DONE",
  "closed": "DONE",
  "отменена": "CANCELLED",
  "отменен": "CANCELLED",
  "отмена": "CANCELLED",
  "cancelled": "CANCELLED",
  "canceled": "CANCELLED",
};

const PRIORITY_SYNONYMS: Record<string, TaskPriority> = {
  "низкий": "LOW",
  "низкая": "LOW",
  "low": "LOW",
  "средний": "MEDIUM",
  "средняя": "MEDIUM",
  "обычный": "MEDIUM",
  "normal": "MEDIUM",
  "medium": "MEDIUM",
  "высокий": "HIGH",
  "высокая": "HIGH",
  "high": "HIGH",
  "критичный": "CRITICAL",
  "критический": "CRITICAL",
  "критичная": "CRITICAL",
  "критично": "CRITICAL",
  "срочно": "CRITICAL",
  "срочная": "CRITICAL",
  "срочный": "CRITICAL",
  "critical": "CRITICAL",
  "urgent": "CRITICAL",
};

/**
 * Строки-итоги («Итого», «Всего») в таблицах идут последними и задачами не являются.
 */
const SUMMARY_TITLES = new Set([
  "итого",
  "итог",
  "всего",
  "сумма",
  "итого по проекту",
  "total",
  "sum",
]);

export function isSummaryTitle(title: string): boolean {
  return SUMMARY_TITLES.has(normalizeHeader(title));
}

export function parseStatus(value: unknown): TaskStatus | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  return STATUS_SYNONYMS[normalized] ?? null;
}

export function parsePriority(value: unknown): TaskPriority | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  return PRIORITY_SYNONYMS[normalized] ?? null;
}
