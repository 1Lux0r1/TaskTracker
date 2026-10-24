import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { GanttScroller } from "@/components/planning/gantt-scroller";
import { NoSystem } from "@/components/planning/no-system";
import { PeriodFields } from "@/components/planning/period-fields";
import { SystemSwitch } from "@/components/planning/system-switch";
import { formatDate, planDkStatus, plural, startOfToday } from "@/lib/domain";
import {
  PLAN_PERIOD_PRESETS,
  columnOf,
  columnSpan,
  parsePlanPeriod,
  periodLabel,
  periodSearch,
  planColumns,
  toMonthValue,
} from "@/lib/planning/period";
import { dkSpan, planSpan, planView, taskTone } from "@/lib/planning/plan-view";
import { loadPlanTree, param, pickSystem } from "@/lib/planning/queries";
import { normalizeQuery } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Ширина колонки диаграммы, пикселей: неделя и месяц. */
const COLUMN = { week: 16, month: 56 } as const;
const LABEL = 340;

const TONES = { dk: "bg-purple-600", ms: "bg-blue-500", repeat: "bg-red-500" } as const;

/**
 * План работ: задачи сгруппированы блок → ДК, справа диаграмма за выбранный
 * период — по неделям или по месяцам. Тот же период и поиск уходят в
 * выгрузку Excel. Задачи по ДК (ОА, БА, Арх) идут первыми под каждым ДК.
 */
export default async function PlanPage(props: PageProps<"/planning/plan">) {
  const params = await props.searchParams;
  const { systems, system } = await pickSystem(params);
  if (!system) return <NoSystem />;

  const rawQuery = param(params, "q") ?? "";
  const q = normalizeQuery(rawQuery);
  const directions = await loadPlanTree(system.id);
  const today = startOfToday();
  const span = planSpan(directions);
  const periodParams = {
    period: param(params, "period"),
    from: param(params, "from"),
    to: param(params, "to"),
    scale: param(params, "scale"),
  };
  const period = parsePlanPeriod(periodParams, today, span);
  const ranges = Object.fromEntries(
    PLAN_PERIOD_PRESETS.filter((item) => item.value !== "custom").map((item) => {
      const range = parsePlanPeriod({ period: item.value }, today, span);
      return [item.value, { from: toMonthValue(range.from), to: toMonthValue(range.to) }];
    }),
  );

  const columns = planColumns(period);
  const COL = COLUMN[period.scale];
  const width = columns.length * COL;
  const todayIndex = columnOf(columns, today);

  // Подписи групп над колонками: месяц для недель, год для месяцев.
  const groups = columns
    .map((column, index) => ({ index, label: column.group }))
    .filter((item, index, all) => index === 0 || item.label !== all[index - 1].label);

  const blocks = planView(directions, { q, period });
  const total = blocks.reduce((sum, block) => sum + block.dks.reduce((n, item) => n + item.tasks.length, 0), 0);

  const search = new URLSearchParams({ system: system.id, ...periodSearch(period), ...(rawQuery ? { q: rawQuery } : {}) });
  const exportHref = `/api/export?entity=plan&${search.toString()}`;
  const resetHref = `/planning/plan?system=${system.id}`;
  const changed = period.preset !== "year" || period.scale !== "week" ? 1 : 0;

  return (
    <div>
      <SystemSwitch systems={systems} selected={system.id} basePath="/planning/plan" />
      <div className="mb-3.5">
        <FilterBar
          resetHref={resetHref}
          activeCount={changed}
          query={rawQuery}
          placeholder="Поиск по шифру и наименованию: RKII.TATep, .TA., .Р2"
        >
          <input type="hidden" name="system" value={system.id} />
          <PeriodFields
            preset={period.preset}
            scale={period.scale}
            from={toMonthValue(period.from)}
            to={toMonthValue(period.to)}
            ranges={ranges}
          />
        </FilterBar>
      </div>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600">
          {periodLabel(period)} · {total} {plural(total, "задача", "задачи", "задач")}
          {q ? " по запросу" : ""}
        </span>
        <a href={exportHref} className="btn-secondary ml-auto">
          Выгрузить в Excel
        </a>
        <Link href="/planning/calculator" className="btn-primary">
          Новая задача
        </Link>
      </div>

      {blocks.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          {q ? "По запросу ничего не нашлось." : "За период в плане нет задач."}
        </p>
      ) : (
        <GanttScroller offset={(todayIndex - (period.scale === "week" ? 6 : 2)) * COL}>
          <div style={{ width: LABEL + width }}>
            {/* Шкала: группы (месяцы или годы) и колонки (недели или месяцы) */}
            <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white">
              <div className="sticky left-0 z-10 flex-none bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.06em] text-gray-500 uppercase" style={{ width: LABEL }}>
                Блок · ДК · задача
              </div>
              <div className="relative h-10 flex-none" style={{ width }}>
                {groups.map((group) => (
                  <span
                    key={group.index}
                    className="absolute top-1 border-l border-gray-200 pl-1 text-[11px] whitespace-nowrap text-gray-600"
                    style={{ left: group.index * COL }}
                  >
                    {group.label}
                  </span>
                ))}
                {columns.map((column, index) =>
                  period.scale === "month" || index % 4 === 1 ? (
                    <span
                      key={index}
                      className="absolute bottom-1 font-mono text-[9.5px] text-gray-400"
                      style={{ left: index * COL + (period.scale === "month" ? 4 : 0) }}
                    >
                      {column.label}
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            {blocks.map(({ direction, part, code: blockCode, dks }) => (
              <div key={part.id}>
                <Row
                  label={
                    <span className="font-mono text-[12.5px] font-semibold text-brand">
                      {blockCode}{" "}
                      <span className="font-sans font-normal text-gray-600">· {direction.name} · {part.name}</span>
                    </span>
                  }
                  className="bg-gray-50"
                  width={width}
                  col={COL}
                  todayIndex={todayIndex}
                />
                {dks.map(({ dk, code, tasks }) => {
                  const status = planDkStatus(dk.status);
                  const range = dkSpan(dk.tasks);
                  const dkCols = range ? columnSpan(columns, range.from, range.to) : null;
                  return (
                    <div key={dk.id}>
                      <Row
                        label={
                          <Link href={`/planning/dk/${dk.id}`} className="block hover:underline">
                            <span className="block truncate text-[13.5px] font-semibold text-gray-900">{dk.name}</span>
                            <span className="flex items-center gap-2 font-mono text-[11.5px] text-gray-500">
                              {code}
                              <span className={`badge font-sans ${status.tone}`}>{status.label}</span>
                            </span>
                          </Link>
                        }
                        width={width}
                        col={COL}
                        todayIndex={todayIndex}
                      >
                        {dkCols && (
                          <span
                            aria-hidden
                            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sky-200"
                            style={{ left: dkCols.first * COL, width: (dkCols.last - dkCols.first + 1) * COL }}
                          />
                        )}
                      </Row>
                      {tasks.length === 0 && (
                        <Row
                          label={<span className="pl-3 text-[12.5px] text-gray-400">задач пока нет</span>}
                          width={width}
                          col={COL}
                          todayIndex={todayIndex}
                        />
                      )}
                      {tasks.map((task) => {
                        const cols =
                          task.startDate && task.finishDate ? columnSpan(columns, task.startDate, task.finishDate) : null;
                        const stage = task.cipher.split(".").at(-1);
                        return (
                          <Row
                            key={task.id}
                            label={
                              <Link href={`/planning/tasks/${task.id}`} className="flex items-center gap-2 pl-3 hover:underline">
                                <span className="w-10 flex-none font-mono text-[12px] font-semibold text-gray-900">{stage}</span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] text-gray-800">{task.name}</span>
                                  <span className="block truncate font-mono text-[11px] text-gray-500">{task.cipher}</span>
                                </span>
                              </Link>
                            }
                            width={width}
                            col={COL}
                            todayIndex={todayIndex}
                          >
                            {cols ? (
                              <span
                                className={`absolute top-1/2 h-4 -translate-y-1/2 rounded ${TONES[taskTone(task)]} px-1 text-[10px] leading-4 font-semibold text-white`}
                                style={{ left: cols.first * COL, width: Math.max(1, cols.last - cols.first + 1) * COL }}
                                title={`${task.cipher}: ${formatDate(task.startDate)} – ${formatDate(task.finishDate)}`}
                              >
                                {(cols.last - cols.first + 1) * COL >= 32 ? stage : ""}
                              </span>
                            ) : (
                              <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[11.5px] text-gray-400">
                                сроки не заданы
                              </span>
                            )}
                          </Row>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </GanttScroller>
      )}
      <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-gray-500">
        <Legend tone="bg-purple-600" label="по пункту: ОА, БА, Арх" />
        <Legend tone="bg-blue-500" label="по МС" />
        <Legend tone="bg-red-500" label="повтор (возврат)" />
        <Legend tone="bg-sky-200" label="срок ДК по задачам" />
        <Legend tone="bg-amber-500" label={period.scale === "week" ? "текущая неделя" : "текущий месяц"} />
      </p>
    </div>
  );
}

function Row({
  label,
  width,
  col,
  todayIndex,
  className = "",
  children,
}: {
  label: React.ReactNode;
  width: number;
  col: number;
  todayIndex: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex border-b border-gray-100 ${className}`}>
      <div
        className={`sticky left-0 z-[5] flex-none px-4 py-1.5 ${className || "bg-white"}`}
        style={{ width: LABEL }}
      >
        {label}
      </div>
      <div className="relative min-h-9 flex-none" style={{ width }}>
        {todayIndex >= 0 && (
          <span aria-hidden className="absolute inset-y-0 w-px bg-amber-500/60" style={{ left: todayIndex * col + col / 2 }} />
        )}
        {children}
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`inline-block h-2.5 w-4 rounded-sm ${tone}`} />
      {label}
    </span>
  );
}
