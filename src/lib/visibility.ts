/**
 * Видимость записи: признак публичного отображения у задачи, письма и
 * документа. Публичная запись попадает в отчёт руководству, служебная
 * остаётся внутри системы. Сотрудник задаёт признак один раз, при заведении,
 * дальше его меняет только администратор — и каждая смена пишется в журнал.
 */
export const VISIBILITY_OPTIONS = [
  {
    value: "PUBLIC",
    label: "Публичная",
    note: "Попадает в отчёт руководству",
  },
  {
    value: "INTERNAL",
    label: "Служебная",
    note: "Остаётся внутри системы",
  },
] as const;

export type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];

/** Сущности, у которых есть признак публичного отображения. */
export const VISIBILITY_ENTITIES = [
  { value: "TASK", label: "Задача", href: "/tasks" },
  { value: "LETTER", label: "Письмо", href: "/letters" },
  { value: "DOCUMENT", label: "Документ", href: "/documents" },
] as const;

export type VisibilityEntity = (typeof VISIBILITY_ENTITIES)[number]["value"];

export function visibilityEntityLabel(value: string): string {
  return VISIBILITY_ENTITIES.find((item) => item.value === value)?.label ?? value;
}

/** Ссылка на запись журнала: из журнала видно, о чём именно была правка. */
export function visibilityEntityHref(entity: string, entityId: string): string | null {
  const found = VISIBILITY_ENTITIES.find((item) => item.value === entity);
  return found ? `${found.href}/${entityId}` : null;
}

export function visibilityLabel(isPublic: boolean): string {
  return isPublic ? "Публичная" : "Служебная";
}

export function visibilityValue(isPublic: boolean): VisibilityValue {
  return isPublic ? "PUBLIC" : "INTERNAL";
}

/**
 * Значения по умолчанию разные: работа проекта обычно идёт в отчёт, а
 * переписка служебная — в письмах реквизиты и ФИО, которые наружу не нужны.
 */
export const VISIBILITY_DEFAULTS: Record<VisibilityEntity, boolean> = {
  TASK: true,
  LETTER: false,
  DOCUMENT: true,
};

/**
 * Видимость из формы. Поля может не быть вовсе: участнику после создания
 * записи его не показывают, и тогда значение не меняется.
 */
export function readVisibility(formData: FormData): boolean | null {
  const raw = formData.get("visibility");
  if (raw === null) return null;
  const value = String(raw);
  if (value === "PUBLIC") return true;
  if (value === "INTERNAL") return false;
  return null;
}
