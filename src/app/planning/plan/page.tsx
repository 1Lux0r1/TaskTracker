import Link from "next/link";
import { GanttScroller } from "@/components/planning/gantt-scroller";
import { NoSystem } from "@/components/planning/no-system";
import { SystemSwitch } from "@/components/planning/system-switch";
import { formatDate, planDkStatus, plural, startOfToday } from "@/lib/domain";
import { planWeeks, weekIndex } from "@/lib/planning/dates";
import {
  blockCipher,
  dkCipher,
  loadPlanTree,
  param,
  pickSystem,
  sortTasks,
} from "@/lib/planning/queries";
import { normalizeQuery } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Ширина недели на диаграмме, пикселей. */
const WEEK = 16;
const LABEL = 340;

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/**
 * План работ: задачи сгруппированы блок → ДК, справа диаграмма по неделям
 * календаря 2026–2027. Задачи по ДК (БА, Арх) идут первыми под каждым ДК.
 */
export default async function PlanPage(props: PageProps<"/planning/plan">) {
  const params = await props.searchParams;
  const { systems, system } = await pickSystem(params);
  if (!system) return <NoSystem />;

  const q = normalizeQuery(param(params, "q") ?? "");
  const directions = await loadPlanTree(system.id);
  const weeks = planWeeks();
  const width = weeks.length * WEEK;
  const todayIndex = weekIndex(startOfToday());

  // Подписи месяцев: месяц недели — по её четвергу, подпись там, где он сменился.
  const months = weeks
    .map((week, index) => {
      const thursday = new Date(week.start.getFullYear(), week.start.getMonth(), week.start.getDate() + 3);
      return { index, month: thursday.getMonth(), year: thursday.getFullYear() };
    })
    .filter((item, index, all) => index === 0 || item.month !== all[index - 1].month)
    .map((item) => ({
      index: item.index,
      label: `${MONTHS[item.month]}${item.month === 0 || item.index === 0 ? ` ${item.year}` : ""}`,
    }));

  const blocks = directions.flatMap((direction) =>
    direction.parts.map((part) => ({
      direction,
      part,
      dks: part.dks
        .map((dk) => {
          const code = dkCipher(direction, part, dk);
          const tasks = sortTasks(dk.tasks).filter(
            (task) => !q || task.searchIndex?.includes(q) || code.toLowerCase().includes(q),
          );
          return { dk, code, tasks };
        })
        .filter((item) => !q || item.tasks.length > 0),
    })),
  ).filter((block) => !q || block.dks.length > 0);

  const total = blocks.reduce((sum, block) => sum + block.dks.reduce((n, item) => n + item.tasks.length, 0), 0);

  return (
    <div>
      <SystemSwitch systems={systems} selected={system.id} basePath="/planning/plan" />
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <form className="min-w-60 flex-1 lg:max-w-md">
          <input
            type="search"
            name="q"
            defaultValue={param(params, "q") ?? ""}
            placeholder="Поиск по шифру и наименованию: RKII.Gaz, .TA., .08."
            className="input mt-0"
          />
        </form>
        <span className="text-sm text-gray-500">
          {total} {plural(total, "задача", "задачи", "задач")}
          {q ? " по запросу" : ""}
        </span>
        <Link href="/planning/calculator" className="btn-primary ml-auto">
          Новая задача
        </Link>
      </div>

      {blocks.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          {q ? "По запросу ничего не нашлось." : "В плане пока нет задач."}
        </p>
      ) : (
        <GanttScroller offset={(todayIndex - 6) * WEEK}>
          <div style={{ width: LABEL + width }}>
            {/* Шкала: месяцы и номера недель */}
            <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white">
              <div className="sticky left-0 z-10 flex-none bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.06em] text-gray-500 uppercase" style={{ width: LABEL }}>
                Блок · ДК · задача
              </div>
              <div className="relative h-10 flex-none" style={{ width }}>
                {months.map((month) => (
                  <span
                    key={month.index}
                    className="absolute top-1 border-l border-gray-200 pl-1 text-[11px] whitespace-nowrap text-gray-600"
                    style={{ left: month.index * WEEK }}
                  >
                    {month.label}
                  </span>
                ))}
                {weeks.map((week, index) =>
                  index % 4 === 1 ? (
                    <span key={index} className="absolute bottom-1 font-mono text-[9.5px] text-gray-400" style={{ left: index * WEEK }}>
                      {week.week}
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            {blocks.map(({ direction, part, dks }) => (
              <div key={part.id}>
                <Row
                  label={
                    <span className="font-mono text-[12.5px] font-semibold text-brand">
                      {blockCipher(direction, part)}{" "}
                      <span className="font-sans font-normal text-gray-600">· {direction.name} · {part.name}</span>
                    </span>
                  }
                  className="bg-gray-50"
                  width={width}
                  todayIndex={todayIndex}
                />
                {dks.map(({ dk, code, tasks }) => {
                  const status = planDkStatus(dk.status);
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
                        todayIndex={todayIndex}
                      />
                      {tasks.length === 0 && (
                        <Row
                          label={<span className="pl-3 text-[12.5px] text-gray-400">задач пока нет</span>}
                          width={width}
                          todayIndex={todayIndex}
                        />
                      )}
                      {tasks.map((task) => {
                        const tone =
                          task.repeat > 1 ? "bg-red-500" : task.module ? "bg-blue-500" : "bg-purple-600";
                        const from = task.startDate ? weekIndex(task.startDate) : null;
                        const to = task.finishDate ? weekIndex(task.finishDate) : null;
                        return (
                          <Row
                            key={task.id}
                            label={
                              <Link href={`/planning/tasks/${task.id}`} className="flex items-center gap-2 pl-3 hover:underline">
                                <span className="w-10 flex-none font-mono text-[12px] font-semibold text-gray-900">
                                  {task.cipher.split(".").at(-1)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] text-gray-800">{task.name}</span>
                                  <span className="block truncate font-mono text-[11px] text-gray-500">{task.cipher}</span>
                                </span>
                              </Link>
                            }
                            width={width}
                            todayIndex={todayIndex}
                          >
                            {from !== null && to !== null ? (
                              <span
                                className={`absolute top-1/2 h-4 -translate-y-1/2 rounded ${tone} px-1 text-[10px] leading-4 font-semibold text-white`}
                                style={{ left: from * WEEK, width: Math.max(1, to - from + 1) * WEEK }}
                                title={`${task.cipher}: ${formatDate(task.startDate)} – ${formatDate(task.finishDate)}`}
                              >
                                {to - from + 1 >= 2 ? task.cipher.split(".").at(-1) : ""}
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
        <Legend tone="bg-purple-600" label="по ДК: БА, Арх" />
        <Legend tone="bg-blue-500" label="по МС" />
        <Legend tone="bg-red-500" label="повтор (возврат)" />
        <Legend tone="bg-amber-500" label="текущая неделя" />
      </p>
    </div>
  );
}

function Row({
  label,
  width,
  todayIndex,
  className = "",
  children,
}: {
  label: React.ReactNode;
  width: number;
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
          <span aria-hidden className="absolute inset-y-0 w-px bg-amber-500/60" style={{ left: todayIndex * WEEK + WEEK / 2 }} />
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
