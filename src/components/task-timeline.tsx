import Link from "next/link";
import { isOverdue, isTaskOpen } from "@/lib/domain";

type TimelineTask = {
  id: string;
  title: string;
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
};

const DAY = 86_400_000;
const MONTH_NAMES = new Intl.DateTimeFormat("ru-RU", { month: "long" });

/**
 * Вид «Сроки» из макета: полоса задачи от начала до срока на общей шкале
 * месяцев, линия сегодняшнего дня. Это не диаграмма Ганта — связей и
 * критического пути нет, только где какая задача лежит по времени.
 */
export function TaskTimeline({ tasks, today }: { tasks: TimelineTask[]; today: Date }) {
  const items = tasks
    .filter((task): task is TimelineTask & { dueDate: Date } => task.dueDate !== null)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  if (items.length === 0) {
    return (
      <div className="card px-5 py-10 text-center text-sm text-gray-500">
        Ни у одной задачи в выборке нет срока.
      </div>
    );
  }

  const begin = (task: TimelineTask & { dueDate: Date }) => {
    const start = task.startDate ?? task.createdAt;
    return start.getTime() > task.dueDate.getTime() ? task.dueDate : start;
  };

  // Шкала — целые месяцы от самого раннего начала до самого позднего срока,
  // но не длиннее года: иначе одна старая задача сжимает всю картину.
  let first = monthStart(new Date(Math.min(today.getTime(), ...items.map((task) => begin(task).getTime()))));
  const last = monthStart(new Date(Math.max(today.getTime(), ...items.map((task) => task.dueDate.getTime()))));
  const end = addMonths(last, 1);
  if (monthsBetween(first, end) > 12) first = addMonths(end, -12);

  const span = end.getTime() - first.getTime();
  const at = (date: Date) =>
    Math.min(100, Math.max(0, ((date.getTime() - first.getTime()) / span) * 100));

  const months: { key: string; label: string; width: number }[] = [];
  for (let month = first; month < end; month = addMonths(month, 1)) {
    const next = addMonths(month, 1);
    months.push({
      key: month.toISOString(),
      label: MONTH_NAMES.format(month),
      width: ((next.getTime() - month.getTime()) / span) * 100,
    });
  }
  const todayAt = at(today);

  return (
    <section className="card p-[18px]">
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-gray-600">
        <Legend color="var(--color-blue-500)">В работе</Legend>
        <Legend color="var(--color-green-600)">Закрыта</Legend>
        <Legend color="var(--color-red-600)">Просрочена</Legend>
        <span className="flex items-center gap-1.5">
          <i className="block h-3 w-[3px] rounded-[1px] bg-copper" />
          Сегодня
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-2 grid grid-cols-[240px_minmax(0,1fr)] gap-3">
            <span />
            <div className="flex text-[11.5px] tracking-[0.06em] text-gray-500 uppercase">
              {months.map((month) => (
                <span key={month.key} style={{ width: `${month.width}%` }} className="truncate">
                  {month.label}
                </span>
              ))}
            </div>
          </div>

          {items.map((task) => {
            const late = isOverdue(task.dueDate, task.status);
            const from = at(begin(task));
            // Просроченная задача тянется до сегодняшнего дня: длина красной
            // полосы за сроком и есть просрочка.
            const to = at(new Date((late ? today : task.dueDate).getTime() + DAY));
            const color = !isTaskOpen(task.status)
              ? "var(--color-green-600)"
              : late
                ? "var(--color-red-600)"
                : "var(--color-blue-500)";
            return (
              <div
                key={task.id}
                className="grid grid-cols-[240px_minmax(0,1fr)] items-center gap-3 py-[5px]"
              >
                <Link
                  href={`/tasks/${task.id}`}
                  title={task.title}
                  className="truncate text-[13.5px] text-gray-900 hover:underline"
                >
                  {task.title}
                </Link>
                <div className="relative h-[22px]">
                  <span
                    className="absolute top-1.5 h-2.5 rounded-[5px]"
                    style={{
                      left: `${from}%`,
                      width: `${Math.max(to - from, 1.2)}%`,
                      background: color,
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-0.5 bg-copper"
                    style={{ left: `${todayAt}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className="block size-2.5 rounded-[3px]" style={{ background: color }} />
      {children}
    </span>
  );
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}
