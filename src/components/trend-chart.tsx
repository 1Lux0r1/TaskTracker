import { formatDate } from "@/lib/domain";
import { areaPath, chartPoints, polylinePoints, type TrendPoint } from "@/lib/trend";

const WIDTH = 320;
const HEIGHT = 80;

type Props = {
  title: string;
  points: TrendPoint[];
  /** Что рисуем: готовность в процентах или число записей. */
  pick: (point: TrendPoint) => number;
  unit?: string;
  /** Верх шкалы: у процентов он всегда 100, иначе график врёт масштабом. */
  ceiling?: number;
  /** Рост — это хорошо (готовность) или плохо (просрочки). */
  growthIsGood: boolean;
  /** Внутри другой карточки — без своей тени, тонкой рамкой. */
  plain?: boolean;
};

/**
 * График динамики. Рисуется на сервере обычным SVG: библиотека графиков ради
 * двух линий тянула бы в страницу лишние сотни килобайт.
 */
export function TrendChart({ title, points, pick, unit = "", ceiling, growthIsGood, plain = false }: Props) {
  const values = points.map(pick);
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const change = last - first;

  const shape = chartPoints(values, WIDTH, HEIGHT, ceiling);
  const good = change === 0 ? null : change > 0 === growthIsGood;
  const stroke = good === null ? "#6b7280" : good ? "#059669" : "#dc2626";

  return (
    <div className={plain ? "min-w-0 rounded-xl border border-gray-200 p-4" : "card min-w-0 p-4"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-semibold tabular-nums text-gray-900">
          {last}
          {unit && <span className="ml-0.5 text-base font-normal text-gray-400">{unit}</span>}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="mt-2 h-20 w-full"
        role="img"
        aria-label={`${title}: было ${first}${unit}, стало ${last}${unit}`}
      >
        <path d={areaPath(shape, HEIGHT)} fill={stroke} fillOpacity={0.08} />
        <polyline
          points={polylinePoints(shape)}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {shape.length > 0 && (
          <circle cx={shape[shape.length - 1].x} cy={shape[shape.length - 1].y} r={3} fill={stroke} />
        )}
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-gray-500">
        <span>{formatDate(points[0]?.date)}</span>
        <span className={good === null ? "" : good ? "text-emerald-700" : "text-red-600"}>
          {change === 0
            ? "без изменений"
            : `${change > 0 ? "+" : "−"}${Math.abs(change)}${unit} за период`}
        </span>
        <span>сегодня</span>
      </div>
    </div>
  );
}
