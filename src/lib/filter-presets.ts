/**
 * Сохранённые наборы фильтров.
 *
 * Условия отбора во всех реестрах живут в адресе страницы, поэтому набор —
 * это просто запомненная строка параметров с именем. Набор личный: у каждого
 * свой срез работы, а общий набор потребовал бы договорённости, кто его
 * меняет.
 */

export const FILTER_SCOPES = [
  { value: "TASK", label: "Задачи", href: "/tasks" },
  { value: "LETTER", label: "Переписка", href: "/letters" },
  { value: "DOCUMENT", label: "Документы", href: "/documents" },
  { value: "MEETING", label: "Встречи", href: "/meetings" },
] as const;

export type FilterScope = (typeof FILTER_SCOPES)[number]["value"];

/** Параметр адреса с применённым набором: по нему реестр и подписывает набор. */
export const PRESET_PARAM = "set";

/** Значение параметра «набор снят руками»: оно же отменяет набор по умолчанию. */
export const NO_PRESET = "none";

export const PRESET_NAME_LIMIT = 40;

/** Сколько наборов на реестр: список должен оставаться обозримым. */
export const PRESET_LIMIT = 12;

export function isFilterScope(value: string): value is FilterScope {
  return FILTER_SCOPES.some((scope) => scope.value === value);
}

export function scopeHref(scope: FilterScope): string {
  return FILTER_SCOPES.find((item) => item.value === scope)?.href ?? "/";
}

/**
 * Строка параметров для хранения: пустые значения выбрасываем, остальные
 * выстраиваем по имени. Тогда один и тот же отбор даёт одну и ту же строку,
 * как бы человек до него ни добрался.
 */
export function presetQuery(params: URLSearchParams | string): string {
  const source = typeof params === "string" ? new URLSearchParams(params) : params;
  const clean = new URLSearchParams();

  for (const [key, value] of Array.from(source.entries()).sort(compareEntries)) {
    // Сам набор в набор не входит, пустые поля — тоже: это не условие отбора.
    if (key === PRESET_PARAM || value.trim() === "") continue;
    clean.append(key, value);
  }

  return clean.toString();
}

/** Адрес реестра с применённым набором. */
export function presetHref(href: string, query: string, id: string): string {
  const params = new URLSearchParams(query);
  params.set(PRESET_PARAM, id);
  return `${href}?${params.toString()}`;
}

/** Адрес реестра без набора: набор по умолчанию при переходе не вернётся. */
export function noPresetHref(href: string): string {
  return `${href}?${PRESET_PARAM}=${NO_PRESET}`;
}

/** Имя набора: обрезаем по длине, пустое имя не сохраняем. */
export function cleanPresetName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, PRESET_NAME_LIMIT);
}

/**
 * Набор по умолчанию применяется только на чистом адресе реестра: любой
 * параметр означает, что человек уже задал отбор сам.
 */
export function shouldApplyDefault(params: Record<string, string | string[] | undefined>): boolean {
  return Object.keys(params).length === 0;
}

function compareEntries(a: [string, string], b: [string, string]): number {
  return a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]);
}
