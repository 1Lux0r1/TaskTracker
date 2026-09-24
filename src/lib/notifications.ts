import { startOfWeek } from "@/lib/calendar";

/**
 * Уведомления о работе: назначение, смена срока, просрочка и запись без
 * движения. Почтового сервера у системы нет, поэтому уведомления живут
 * внутри неё — экраном и счётчиком в шапке.
 */
export const NOTIFICATION_KINDS = [
  { value: "ASSIGNED", label: "Назначение", tone: "bg-blue-50 text-blue-700" },
  { value: "DUE_CHANGED", label: "Срок изменён", tone: "bg-violet-50 text-violet-700" },
  { value: "OVERDUE", label: "Просрочено", tone: "bg-red-50 text-red-700" },
  { value: "STALE", label: "Без движения", tone: "bg-amber-50 text-amber-700" },
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["value"];

export function notificationKindLabel(value: string): string {
  return NOTIFICATION_KINDS.find((item) => item.value === value)?.label ?? value;
}

export function notificationKindTone(value: string): string {
  return NOTIFICATION_KINDS.find((item) => item.value === value)?.tone ?? "bg-gray-100 text-gray-600";
}

/** Сколько дней без правок считается «записью без движения». */
export const STALE_DAYS = 14;

/**
 * Ключ события. Одно и то же уведомление не должно появляться снова при
 * каждом открытии экрана, поэтому в ключ входит то, что событие определяет:
 * для просрочки — сам срок, для записи без движения — неделя.
 */
export function notificationKey(
  kind: NotificationKind,
  entity: string,
  entityId: string,
  stamp: string,
): string {
  return `${kind}:${entity}:${entityId}:${stamp}`;
}

/** Дата в ключе: без времени, иначе одно событие даст несколько ключей. */
export function dayStamp(value: Date | null | undefined): string {
  if (!value) return "none";
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

/**
 * Неделя в ключе: о записи без движения напоминаем не чаще раза в неделю,
 * иначе список превратится в шум из одних и тех же строк. Неделя считается
 * от понедельника — так напоминание приходит в начале рабочей недели, а не в
 * произвольный день.
 */
export function weekStamp(value: Date): string {
  return `w${dayStamp(startOfWeek(value))}`;
}

/** Запись без движения: открыта и давно не правилась. */
export function isStale(updatedAt: Date, today: Date, days: number = STALE_DAYS): boolean {
  return today.getTime() - updatedAt.getTime() >= days * 86_400_000;
}

/** Сколько дней запись стоит без правок — для текста уведомления. */
export function daysWithoutMovement(updatedAt: Date, today: Date): number {
  return Math.floor((today.getTime() - updatedAt.getTime()) / 86_400_000);
}
