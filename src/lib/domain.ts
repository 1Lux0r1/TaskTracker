/**
 * Справочники статусов и приоритетов. SQLite не поддерживает enum на уровне БД,
 * поэтому значения хранятся строками, а единственным источником правды служит этот файл.
 */

export const TASK_STATUSES = [
  "NEW",
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NEW: "Новая",
  BACKLOG: "Бэклог",
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Готово",
  CANCELLED: "Отменена",
};

/** Колонки канбан-доски: отменённые задачи на доске не показываем. */
export const BOARD_COLUMNS: TaskStatus[] = [
  "NEW",
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export const CLOSED_TASK_STATUSES: TaskStatus[] = ["DONE", "CANCELLED"];

/** Статус только что заведённой задачи: в форме создания его не выбирают. */
export const NEW_TASK_STATUS: TaskStatus = "NEW";

/* ─── Артефакты задачи ────────────────────────────────────────────────────── */

/**
 * Артефакт — подтверждение работы. Видов пять: карточка в ЭДО, задача во
 * внешнем трекере, документ системы, произвольная ссылка и просто значение.
 */
export const ARTIFACT_KINDS = [
  { value: "EDO_LINK", label: "Ссылка на ЭДО", placeholder: "https://mosedo.mos.ru/…" },
  { value: "JIRA_LINK", label: "Ссылка на Jira", placeholder: "https://jira…/browse/KEY-1" },
  { value: "SYSTEM_DOC", label: "Документ системы", placeholder: "" },
  { value: "CUSTOM_LINK", label: "Своя ссылка", placeholder: "https://…" },
  { value: "CUSTOM_VALUE", label: "Своё значение", placeholder: "Номер, решение, комментарий" },
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number]["value"];

export function artifactKindLabel(value: string): string {
  return ARTIFACT_KINDS.find((item) => item.value === value)?.label ?? value;
}

/** Ссылку показываем ссылкой, значение — текстом. */
export function isLinkArtifact(kind: string): boolean {
  return kind === "EDO_LINK" || kind === "JIRA_LINK" || kind === "CUSTOM_LINK";
}

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критичный",
};

export const PROJECT_STATUSES = [
  "PLANNED",
  "ACTIVE",
  "ON_HOLD",
  "DONE",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Планируется",
  ACTIVE: "В работе",
  ON_HOLD: "Приостановлен",
  DONE: "Завершён",
  CANCELLED: "Отменён",
};

export function taskStatusLabel(value: string): string {
  return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
}

export function taskPriorityLabel(value: string): string {
  return TASK_PRIORITY_LABELS[value as TaskPriority] ?? value;
}

export function projectStatusLabel(value: string): string {
  return PROJECT_STATUS_LABELS[value as ProjectStatus] ?? value;
}

export function isTaskOpen(status: string): boolean {
  return !CLOSED_TASK_STATUSES.includes(status as TaskStatus);
}

/** Задача просрочена, если срок в прошлом и она ещё не закрыта. */
export function isOverdue(dueDate: Date | null, status: string): boolean {
  if (!dueDate || !isTaskOpen(status)) return false;
  return dueDate.getTime() < startOfToday().getTime();
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

/** Значение для <input type="date"> в локальном часовом поясе. */
export function toDateInputValue(value: Date | null | undefined): string {
  if (!value) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}


/* ─── Треки работ ─────────────────────────────────────────────────────────── */

/**
 * Треки — справочник проекта: команда заводит свои. Эти четыре приходят из
 * Excel и создаются вместе с проектом как обычные записи, их можно
 * переименовать, перекрасить или убрать в архив.
 */
export const BASE_TRACKS = [
  { key: "PRODUCTION", name: "Производственный", color: "blue", sortOrder: 0 },
  { key: "INTERNAL", name: "Внутренний", color: "gray", sortOrder: 1 },
  { key: "EXTERNAL", name: "Внешний", color: "orange", sortOrder: 2 },
  { key: "LEGAL", name: "Юридический", color: "purple", sortOrder: 3 },
] as const;

export type BaseTrackKey = (typeof BASE_TRACKS)[number]["key"];

/** Цвет несёт смысл: синий — обычное, оранжевый — внимание, красный —
 *  просрочено, зелёный — закрыто, фиолетовый — встречи и история. */
export const TRACK_COLORS = [
  { value: "blue", label: "Синий", dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  { value: "orange", label: "Оранжевый", dot: "bg-orange-500", chip: "bg-orange-50 text-orange-700" },
  { value: "red", label: "Красный", dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
  { value: "green", label: "Зелёный", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  { value: "purple", label: "Фиолетовый", dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  { value: "gray", label: "Серый", dot: "bg-gray-400", chip: "bg-gray-100 text-gray-700" },
] as const;

export type TrackColor = (typeof TRACK_COLORS)[number]["value"];

export function trackColor(value: string) {
  return TRACK_COLORS.find((item) => item.value === value) ?? TRACK_COLORS[0];
}

/* ─── Письма ЭДО ──────────────────────────────────────────────────────────── */

export const LETTER_DIRECTIONS = ["INCOMING", "OUTGOING"] as const;
export type LetterDirection = (typeof LETTER_DIRECTIONS)[number];

export const LETTER_DIRECTION_LABELS: Record<LetterDirection, string> = {
  INCOMING: "Входящее",
  OUTGOING: "Исходящее",
};

/**
 * Подписи полей письма зависят от направления: «от кого» у входящего и
 * «кому» у исходящего. Форма заведения и форма правки берут их отсюда,
 * чтобы называть одно и то же одинаково.
 */
export const LETTER_DIRECTION_TEXT: Record<
  LetterDirection,
  { number: string; date: string; counterparty: string; due: string }
> = {
  INCOMING: {
    number: "Входящий номер",
    date: "Дата поступления",
    counterparty: "От кого",
    due: "Срок ответа",
  },
  OUTGOING: {
    number: "Исходящий номер",
    date: "Дата отправки",
    counterparty: "Кому",
    due: "Контроль ответа до",
  },
};

export const LETTER_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "ON_APPROVAL",
  "ANSWERED",
  "SIGNED",
  "NOTED",
  "CLOSED",
] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

export const LETTER_STATUS_LABELS: Record<LetterStatus, string> = {
  NEW: "Новое",
  IN_PROGRESS: "В работе",
  ON_APPROVAL: "На согласовании",
  ANSWERED: "Дан ответ",
  SIGNED: "Подписано",
  NOTED: "Принято к сведению",
  CLOSED: "Закрыто",
};

/** Письмо отработано: срок по нему больше не горит. */
export const CLOSED_LETTER_STATUSES: LetterStatus[] = ["ANSWERED", "SIGNED", "NOTED", "CLOSED"];

export function letterStatusLabel(value: string): string {
  return LETTER_STATUS_LABELS[value as LetterStatus] ?? value;
}

export function letterDirectionLabel(value: string): string {
  return LETTER_DIRECTION_LABELS[value as LetterDirection] ?? value;
}

export function isLetterOpen(status: string): boolean {
  return !CLOSED_LETTER_STATUSES.includes(status as LetterStatus);
}

/* ─── Встречи ─────────────────────────────────────────────────────────────── */

/**
 * Вид встречи. Перечень короткий намеренно: он нужен, чтобы отличать
 * внутреннее обсуждение от встречи со сторонней организацией, а не чтобы
 * описать всё многообразие совещаний.
 */
export const MEETING_KINDS = [
  "WORKING",
  "STATUS",
  "TECHNICAL",
  "COUNTERPARTY",
  "OTHER",
] as const;
export type MeetingKind = (typeof MEETING_KINDS)[number];

export const MEETING_KIND_LABELS: Record<MeetingKind, string> = {
  WORKING: "Рабочая",
  STATUS: "Статус проекта",
  TECHNICAL: "Техническая",
  COUNTERPARTY: "С организацией",
  OTHER: "Иная",
};

export function meetingKindLabel(value: string): string {
  return MEETING_KIND_LABELS[value as MeetingKind] ?? value;
}

/** Время встречи: «10:00 — 11:30», «с 10:00» или пусто. */
export function formatMeetingTime(start: string | null, end: string | null): string {
  if (start && end) return `${start} — ${end}`;
  if (start) return `с ${start}`;
  if (end) return `до ${end}`;
  return "";
}

/** Встреча ещё впереди, если её день не раньше сегодняшнего. */
export function isUpcomingMeeting(date: Date, today: Date = startOfToday()): boolean {
  return date.getTime() >= today.getTime();
}

/* ─── Юридически значимые документы ───────────────────────────────────────── */

export const DOCUMENT_KINDS = [
  "REGULATION",
  "NDA_ADDENDUM",
  "CONTRACT",
  "STATEMENT",
  "OTHER",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  REGULATION: "Регламент",
  NDA_ADDENDUM: "ДС к NDA",
  CONTRACT: "Контракт",
  STATEMENT: "Положение",
  OTHER: "Другое",
};

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "REVIEW",
  "RETURNED",
  "SENT",
  "SIGNING",
  "SIGNED",
  "DECLINED",
  "FILED",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Черновик",
  REVIEW: "На согласовании",
  RETURNED: "Возвращён на доработку",
  SENT: "Направлен стороне",
  SIGNING: "На подписании",
  SIGNED: "Подписан",
  DECLINED: "Отказ в подписании",
  FILED: "Передан в дело",
};

/**
 * Стадии, которые ставит человек, а не матрица подписания: документ вернули
 * на доработку или убрали в дело. Матрица их не перебивает.
 */
export const MANUAL_DOCUMENT_STATUSES: DocumentStatus[] = ["RETURNED", "FILED"];

/**
 * Порядок стадий для списка: сначала то, что требует действий, в конце —
 * законченное. В базе статус хранится строкой, поэтому по этому порядку
 * список сортируется в приложении, а не запросом.
 */
export const DOCUMENT_STAGE_ORDER: DocumentStatus[] = [
  "DECLINED",
  "RETURNED",
  "DRAFT",
  "REVIEW",
  "SENT",
  "SIGNING",
  "SIGNED",
  "FILED",
];

export function documentStageRank(status: string): number {
  const index = DOCUMENT_STAGE_ORDER.indexOf(status as DocumentStatus);
  return index === -1 ? DOCUMENT_STAGE_ORDER.length : index;
}

export const SIGNATURE_STATUSES = ["PENDING", "SIGNED", "DECLINED", "NOT_REQUIRED"] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  PENDING: "Ожидает",
  SIGNED: "Подписано",
  DECLINED: "Отказ",
  NOT_REQUIRED: "Не требуется",
};

export function documentKindLabel(value: string): string {
  return DOCUMENT_KIND_LABELS[value as DocumentKind] ?? value;
}

export function documentStatusLabel(value: string): string {
  return DOCUMENT_STATUS_LABELS[value as DocumentStatus] ?? value;
}

export function signatureStatusLabel(value: string): string {
  return SIGNATURE_STATUS_LABELS[value as SignatureStatus] ?? value;
}

/**
 * Статус документа выводится из подписей сторон: пока хоть одна обязательная
 * сторона не подписала, документ не подписан. Отказ любой стороны — блокер.
 */
export function deriveDocumentStatus(
  signatures: { status: string }[],
  fallback: string,
): string {
  // «Возвращён на доработку» и «Передан в дело» ставят руками: это стадии
  // работы с документом, а не итог подписания, и матрица их не отменяет.
  if (MANUAL_DOCUMENT_STATUSES.includes(fallback as DocumentStatus)) return fallback;

  const required = signatures.filter((item) => item.status !== "NOT_REQUIRED");
  if (required.length === 0) return fallback;
  if (required.some((item) => item.status === "DECLINED")) return "DECLINED";
  if (required.every((item) => item.status === "SIGNED")) return "SIGNED";
  if (required.some((item) => item.status === "SIGNED")) return "SIGNING";
  return fallback;
}

/** Доля подписавших сторон — для полосы прогресса в списке документов. */
export function signatureProgress(signatures: { status: string }[]): number {
  const required = signatures.filter((item) => item.status !== "NOT_REQUIRED");
  if (required.length === 0) return 0;
  const signed = required.filter((item) => item.status === "SIGNED").length;
  return Math.round((signed / required.length) * 100);
}

/** Период отчёта: две недели по умолчанию, как в исходных таблицах. */
export function formatPeriod(start: Date, end: Date): string {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

/* ─── Справочная информация ───────────────────────────────────────────────── */

/**
 * Разделы справочника: команда держит рядом с работой описание системы,
 * паспорт проекта и правила подписания. Список закрытый — иначе разделы
 * расплодятся и справочник превратится в свалку заметок.
 */
export const REFERENCE_SECTIONS = [
  { value: "ARCHITECTURE", label: "Архитектура системы" },
  { value: "PASSPORT", label: "Паспорт проекта" },
  { value: "SIGNING", label: "Матрица подписания" },
  { value: "PROCESS", label: "Порядок работы" },
  { value: "OTHER", label: "Прочее" },
] as const;

export type ReferenceSection = (typeof REFERENCE_SECTIONS)[number]["value"];

export function referenceSectionLabel(value: string): string {
  return REFERENCE_SECTIONS.find((item) => item.value === value)?.label ?? value;
}

/**
 * Русская форма числительного: 1 страница, 2 страницы, 5 страниц.
 * «11 страниц», а не «11 страница» — отсюда отдельная проверка десятков.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100;
  if (tens >= 11 && tens <= 14) return many;

  const units = count % 10;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

/* ─── График интеграций ───────────────────────────────────────────────────── */

/**
 * Этапы интеграции организации. Строка графика — организация, колонка —
 * этап: в исходном файле это отдельный лист «График интеграций с РСО».
 * Порядок важен: по нему считается, докуда организация дошла.
 */
export const INTEGRATION_STAGES = [
  { value: "REGULATION_SENT", label: "Регламент направлен", short: "Направлен" },
  { value: "REGULATION_SIGNED", label: "Регламент подписан", short: "Подписан" },
  { value: "SYSTEM_READY", label: "Система организации готова", short: "Готовность" },
  { value: "DEV_INTEGRATION", label: "Интеграция в dev-среде", short: "Dev" },
  { value: "TEST_OPENED", label: "Открытие в тестовой среде", short: "Тест" },
] as const;

export type IntegrationStage = (typeof INTEGRATION_STAGES)[number]["value"];

export function integrationStageLabel(value: string): string {
  return INTEGRATION_STAGES.find((item) => item.value === value)?.label ?? value;
}

export type MilestoneState = "done" | "overdue" | "soon" | "planned" | "empty";

/**
 * Состояние вехи: факт важнее плана, просрочка считается от сегодняшнего дня,
 * «скоро» — неделя вперёд. Цвет в графике берётся отсюда.
 */
export function milestoneState(
  milestone: { plannedDate: Date | null; actualDate: Date | null } | undefined,
  today: Date,
): MilestoneState {
  if (!milestone) return "empty";
  if (milestone.actualDate) return "done";
  if (!milestone.plannedDate) return "empty";
  if (milestone.plannedDate < today) return "overdue";
  if (milestone.plannedDate.getTime() <= today.getTime() + 7 * 86_400_000) return "soon";
  return "planned";
}

/** Докуда организация дошла: число пройденных этапов подряд с начала. */
export function integrationProgress(
  milestones: { stage: string; actualDate: Date | null }[],
): number {
  const done = new Set(
    milestones.filter((item) => item.actualDate).map((item) => item.stage),
  );

  let passed = 0;
  for (const stage of INTEGRATION_STAGES) {
    if (!done.has(stage.value)) break;
    passed += 1;
  }
  return passed;
}
