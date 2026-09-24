/**
 * Поисковая строка записи. SQLite не приводит кириллицу к нижнему регистру
 * в LIKE, поэтому строку готовим заранее и ищем по ней подстрокой.
 */
export function buildSearchIndex(parts: (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

/** Запрос приводим к тому же виду, что и индекс. */
export function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
