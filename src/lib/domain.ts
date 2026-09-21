/**
 * Справочники статусов и приоритетов. SQLite не поддерживает enum на уровне БД,
 * поэтому значения хранятся строками, а единственным источником правды служит этот файл.
 */

export const TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Бэклог",
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Готово",
  CANCELLED: "Отменена",
};

/** Колонки канбан-доски: отменённые задачи на доске не показываем. */
export const BOARD_COLUMNS: TaskStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export const CLOSED_TASK_STATUSES: TaskStatus[] = ["DONE", "CANCELLED"];

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
