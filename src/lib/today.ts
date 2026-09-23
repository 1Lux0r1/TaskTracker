/**
 * Раздел «Сегодня»: обращение к человеку и состав счётчиков.
 *
 * Экран собирается из списка блоков, поэтому всё, что решает, как блок
 * выглядит и что в нём показано, живёт здесь и проверяется тестами.
 */

/**
 * Имя для обращения. Своё поле важнее ФИО: в справочнике пишут
 * «Сидоров Алексей Петрович», а обращаться нужно «Алексей».
 */
export function greetingName(fullName: string, displayName?: string | null): string {
  const own = displayName?.trim();
  if (own) return own;

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  // В справочнике фамилия стоит первой, поэтому имя — второе слово.
  return parts[1] ?? parts[0] ?? "";
}

/** Приветствие по времени суток: утро до 12, день до 18, вечер до 23. */
export function greeting(date: Date, name: string): string {
  const hour = date.getHours();
  const part =
    hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  return name ? `${part}, ${name}` : part;
}

export type CountSegment = {
  key: string;
  label: string;
  count: number;
  /** Класс заливки куска полосы состава. */
  bar: string;
};

export type SegmentShare = CountSegment & { percent: number };

/**
 * Полоса состава: доли считаются от суммы, пустые куски отбрасываются.
 * Последнему куску отдаётся остаток, иначе из-за округления полоса не
 * дотягивается до края.
 */
export function segmentShares(segments: CountSegment[]): SegmentShare[] {
  const visible = segments.filter((segment) => segment.count > 0);
  const total = visible.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) return [];

  let used = 0;
  return visible.map((segment, index) => {
    const percent =
      index === visible.length - 1 ? 100 - used : Math.round((segment.count / total) * 100);
    used += percent;
    return { ...segment, percent };
  });
}

/** Строка разбивки под полосой: «в работе 5 · на проверке 2». */
export function breakdownText(segments: CountSegment[]): string {
  const visible = segments.filter((segment) => segment.count > 0);
  if (visible.length === 0) return "пока пусто";
  return visible
    .map((segment) => `${segment.label.toLowerCase()} ${segment.count}`)
    .join(" · ");
}
