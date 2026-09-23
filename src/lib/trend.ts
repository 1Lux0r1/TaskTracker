/**
 * Динамика во времени: как менялись готовность и просрочки.
 *
 * Снимков метрик система не ведёт и планировщика у неё нет, но прошлое
 * считается из самих записей: у задачи есть дата закрытия, у письма и
 * документа — дата исполнения и срок. Поэтому на любой день видно, что к
 * нему было закрыто и что к нему уже просрочено.
 *
 * Состав записей при этом берётся сегодняшний: в исходных таблицах нет дат
 * заведения строк, и «сколько задач было в работе в июле» по ним не
 * восстановить. График отвечает на вопрос «как двигался нынешний состав
 * работ», и подпись под ним говорит об этом прямо.
 */
export type TrendRecord = {
  dueDate: Date | null;
  /** Дата, когда запись закрыли: у задачи — закрытия, у письма — исполнения. */
  closedAt: Date | null;
};

export type TrendPoint = {
  date: Date;
  done: number;
  overdue: number;
  /** Готовность в процентах от общего числа записей. */
  readiness: number;
};

export const TREND_RANGES = [
  { value: "4", label: "4 недели" },
  { value: "12", label: "12 недель" },
  { value: "26", label: "полгода" },
] as const;

export const DEFAULT_TREND_WEEKS = 12;

/** Недели из адреса: чужое значение не должно ломать страницу. */
export function readTrendWeeks(raw: string | undefined): number {
  return TREND_RANGES.some((range) => range.value === raw) ? Number(raw) : DEFAULT_TREND_WEEKS;
}

/**
 * Точки графика: по одной на неделю, последняя — сегодня. Отсчёт идёт назад
 * от сегодняшнего дня, чтобы правый край всегда совпадал с цифрами вверху
 * страницы.
 */
export function trendDates(today: Date, weeks: number): Date[] {
  const dates: Date[] = [];
  for (let step = weeks; step >= 0; step -= 1) {
    dates.push(new Date(today.getTime() - step * 7 * 86_400_000));
  }
  return dates;
}

/** Состояние набора записей на каждый день из списка. */
export function buildTrend(records: TrendRecord[], dates: Date[]): TrendPoint[] {
  return dates.map((date) => {
    let done = 0;
    let overdue = 0;

    for (const record of records) {
      const closed = record.closedAt !== null && record.closedAt <= date;
      if (closed) {
        done += 1;
        continue;
      }
      if (record.dueDate !== null && record.dueDate < date) overdue += 1;
    }

    return {
      date,
      done,
      overdue,
      readiness: records.length === 0 ? 0 : Math.round((done / records.length) * 100),
    };
  });
}

/** Насколько изменилось значение за показанный период. */
export function trendChange(values: number[]): number {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

/** Подпись к изменению: «+12» и «−3» читаются быстрее, чем «12» и «3». */
export function changeLabel(change: number, unit = ""): string {
  const suffix = unit ? ` ${unit}` : "";
  if (change === 0) return `без изменений${suffix ? suffix.trimEnd() : ""}`.trim();
  const sign = change > 0 ? "+" : "−";
  return `${sign}${Math.abs(change)}${suffix}`;
}

/**
 * Точки в координатах картинки. Ширина и высота — в единицах viewBox, чтобы
 * график тянулся по месту, а не по числу точек.
 */
export function chartPoints(
  values: number[],
  width: number,
  height: number,
  maxValue?: number,
): { x: number; y: number }[] {
  if (values.length === 0) return [];

  const top = Math.max(maxValue ?? Math.max(...values), 1);
  const step = values.length === 1 ? 0 : width / (values.length - 1);

  return values.map((value, index) => ({
    x: Math.round(index * step * 100) / 100,
    y: Math.round((height - (value / top) * height) * 100) / 100,
  }));
}

/** Ломаная для <polyline>. */
export function polylinePoints(points: { x: number; y: number }[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

/** Заливка под ломаной: та же линия, замкнутая по нижнему краю. */
export function areaPath(points: { x: number; y: number }[], height: number): string {
  if (points.length === 0) return "";
  const line = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
  const last = points[points.length - 1];
  return `M ${points[0].x} ${height} ${line} L ${last.x} ${height} Z`;
}
