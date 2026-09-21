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
  { key: "title", header: "Задача", width: 46, aliases: ["задача", "название", "наименование", "работа", "тема", "title", "task", "name", "письмо, задача, поручение", "задача, поручение", "поручение", "мероприятие"] },
  { key: "description", header: "Описание", width: 46, aliases: ["описание", "комментарий", "примечание", "детали", "description", "notes"] },
  { key: "status", header: "Статус", width: 16, aliases: ["статус", "состояние", "этап", "status", "state"] },
  { key: "priority", header: "Приоритет", width: 14, aliases: ["приоритет", "важность", "priority"] },
  { key: "assignee", header: "Ответственный", width: 26, aliases: ["ответственный", "исполнитель", "ответственные", "кто", "assignee", "owner", "responsible", "ответственный от дит", "ответственный от нас", "внутренний ответственный"] },
  { key: "externalAssignee", header: "Внешний ответственный", width: 26, aliases: ["внешний ответственный", "ответственный от контрагента", "контактное лицо"] },
  { key: "startDate", header: "Начало", width: 14, aliases: ["начало", "дата начала", "старт", "start", "start date", "дата создания", "создано"] },
  { key: "dueDate", header: "Срок", width: 14, aliases: ["срок", "дедлайн", "дата окончания", "окончание", "план", "due", "due date", "deadline", "finish", "плановый срок", "срок исполнения"] },
  { key: "estimateHours", header: "Оценка, ч", width: 12, aliases: ["оценка", "оценка, ч", "план часов", "трудоёмкость", "трудоемкость", "estimate", "estimate hours"] },
  { key: "spentHours", header: "Факт, ч", width: 12, aliases: ["факт", "факт, ч", "потрачено", "затрачено", "spent", "actual"] },
  { key: "progress", header: "Готовность, %", width: 14, aliases: ["готовность", "готовность, %", "прогресс", "процент", "% выполнения", "progress", "complete"] },
  { key: "resultLink", header: "Результат", width: 40, aliases: ["результат", "ссылка", "ссылки", "результат (ссылки на эдо и другие ресурсы)", "ссылка на результат"] },
  { key: "track", header: "Трек", width: 18, aliases: ["трек", "направление работ", "тип работ"] },
];

/** Колонки реестра переписки ЭДО. Заголовки взяты из реальных реестров. */
export const LETTER_COLUMNS: TaskColumn[] = [
  { key: "number", header: "Номер письма", width: 22, aliases: ["номер письма", "номер", "рег номер", "исходящий номер", "входящий номер"] },
  { key: "date", header: "Дата письма", width: 14, aliases: ["дата письма", "дата", "дата регистрации"] },
  { key: "subject", header: "Тема", width: 60, aliases: ["тема", "краткое содержание", "содержание", "наименование"] },
  { key: "url", header: "Ссылка на письмо", width: 40, aliases: ["ссылка на письмо", "ссылка", "ссылка на эдо", "карточка"] },
  { key: "direction", header: "Тип", width: 14, aliases: ["тип", "направление", "вид"] },
  { key: "counterparty", header: "Контрагент", width: 28, aliases: ["контрагент", "организация", "адресат", "отправитель", "корреспондент"] },
  { key: "dueDate", header: "Срок исполнения", width: 16, aliases: ["срок исполнения", "срок", "дедлайн"] },
  { key: "responseRef", header: "Ответ реквизиты", width: 28, aliases: ["ответ реквизиты", "реквизиты ответа", "ответ"] },
  { key: "status", header: "Статус", width: 20, aliases: ["статус", "состояние"] },
  { key: "externalTaskKey", header: "Задача в Jira", width: 24, aliases: ["задача в jira", "jira", "задача в трекере", "ссылка на задачу"] },
  { key: "comment", header: "Комментарий", width: 40, aliases: ["комментарий", "примечание"] },
];

/**
 * Колонки реестра подписания. Строка такого реестра — организация, а статусы
 * сторон разложены по отдельным колонкам «Статус подписания <сторона>»,
 * поэтому стороны определяются не списком, а разбором заголовков.
 */
export const DOCUMENT_COLUMNS: TaskColumn[] = [
  { key: "counterparty", header: "Контрагент", width: 28, aliases: ["рсо", "контрагент", "организация", "сторона"] },
  { key: "title", header: "Документ", width: 50, aliases: ["документ", "название", "наименование", "предмет"] },
  { key: "finalStatus", header: "Итоговый статус подписания", width: 34, aliases: ["итоговый статус подписания", "итоговый статус"] },
  { key: "statusNote", header: "Актуальный статус", width: 34, aliases: ["актуальный статус", "статус согласования"] },
  { key: "nextAction", header: "Актуальные задачи", width: 40, aliases: ["актуальные задачи", "задача администратору", "что сделать", "следующий шаг"] },
  { key: "owner", header: "Ответственный", width: 24, aliases: ["ответственный", "исполнитель"] },
  { key: "outgoingLetter", header: "Письмо из ДИТ", width: 30, aliases: ["письмо из дит которым отправлено в рсо и", "письмо из дит", "исходящее письмо", "направлен из дит в рсо", "направлен из дит"] },
  { key: "incomingLetter", header: "Письмо с ответом", width: 30, aliases: ["письмо в эдо с ответом от рсо и/или джкх", "письмо с ответом", "ответ от рсо", "входящее письмо", "ответ"] },
  { key: "url", header: "Ссылка на ЭДО", width: 40, aliases: ["ссылка на эдо", "ссылка"] },
  { key: "dueDate", header: "Срок", width: 16, aliases: ["срок инеграции, факт", "срок интеграции, факт", "срок интеграции", "срок"] },
];

/**
 * Заголовок вида «Статус подписания ДЖКХ» или «Статус ДИТ» → сторона.
 * «Статус согласования» стороной не является: это общий статус строки,
 * поэтому такие слова отсеиваются стоп-листом.
 */
const PARTY_HEADER = /^статус(?:\s+подписания|\s+согласования)?\s+(.+)$/;

const NOT_A_PARTY = new Set([
  "согласования",
  "подписания",
  "выполнения",
  "готовности",
  "задачи",
  "работ",
  "документа",
]);

export function partyFromHeader(raw: unknown): string | null {
  const match = PARTY_HEADER.exec(normalizeHeader(raw));
  if (!match) return null;

  const party = match[1].trim();
  if (party.length === 0 || party.length > 60 || NOT_A_PARTY.has(party)) return null;
  return party.toUpperCase();
}

/** Итоговая формулировка реестра сильнее статусов сторон, если в ней отказ. */
export function isRefusalNote(value: string | null | undefined): boolean {
  const normalized = normalizeHeader(value);
  if (!normalized) return false;
  return (
    normalized.startsWith("отказ") ||
    normalized.startsWith("не согласован") ||
    normalized.startsWith("не подписан") ||
    normalized.includes("отказали в подписании")
  );
}

const PARTY_STATUS_SYNONYMS: Record<string, string> = {
  "подписан": "SIGNED",
  "подписано": "SIGNED",
  "согласован": "SIGNED",
  "нет": "PENDING",
  "не подписан": "PENDING",
  "в работе": "PENDING",
  "заслан": "PENDING",
  "отправлен": "PENDING",
  "на рассмотрении": "PENDING",
  "не согласован": "DECLINED",
  "отказ": "DECLINED",
  "отказано": "DECLINED",
  "не требуется": "NOT_REQUIRED",
};

/** Статус стороны. «Не согласован РСО» и подобное разбирается по префиксу. */
export function parsePartyStatus(value: unknown): string | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (PARTY_STATUS_SYNONYMS[normalized]) return PARTY_STATUS_SYNONYMS[normalized];

  const prefix = Object.keys(PARTY_STATUS_SYNONYMS)
    .filter((key) => normalized.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? PARTY_STATUS_SYNONYMS[prefix] : null;
}

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
export function matchColumns(
  headerRow: unknown[],
  schema: TaskColumn[] = TASK_COLUMNS,
): Map<number, string> {
  const result = new Map<number, string>();
  const taken = new Set<string>();
  const headers = headerRow.map((raw) => normalizeHeader(raw));

  headers.forEach((normalized, index) => {
    if (!normalized) return;
    const column = schema.find(
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
    const column = schema.filter((candidate) => !taken.has(candidate.key))
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

const LETTER_STATUS_SYNONYMS: Record<string, string> = {
  "новое": "NEW",
  "новый": "NEW",
  "зарегистрировано": "NEW",
  "в работе": "IN_PROGRESS",
  "ответ в работе": "IN_PROGRESS",
  "отработка": "IN_PROGRESS",
  "на согласовании": "ON_APPROVAL",
  "ответ на согласовании": "ON_APPROVAL",
  "на рассмотрении": "ON_APPROVAL",
  "дан ответ": "ANSWERED",
  "ответ дан": "ANSWERED",
  "отвечено": "ANSWERED",
  "подписано": "SIGNED",
  "подписан": "SIGNED",
  "принято к сведению": "NOTED",
  "к сведению": "NOTED",
  "закрыто": "CLOSED",
  "исполнено": "CLOSED",
};

/**
 * Статус письма. В реестрах он часто дописан деталями («На согласовании у
 * Баринова А.Ю.»), поэтому кроме точного совпадения пробуем префикс.
 */
export function parseLetterStatus(value: unknown): string | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (LETTER_STATUS_SYNONYMS[normalized]) return LETTER_STATUS_SYNONYMS[normalized];

  const prefix = Object.keys(LETTER_STATUS_SYNONYMS)
    .filter((key) => normalized.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? LETTER_STATUS_SYNONYMS[prefix] : null;
}

export function parseLetterDirection(value: unknown): string | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (normalized.startsWith("вход")) return "INCOMING";
  if (normalized.startsWith("исход")) return "OUTGOING";
  return null;
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
