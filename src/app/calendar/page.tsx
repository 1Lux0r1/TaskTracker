import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  CLOSED_LETTER_STATUSES,
  CLOSED_TASK_STATUSES,
  formatDate,
  startOfToday,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

type CalendarEvent = {
  id: string;
  href: string;
  label: string;
  kind: "task" | "letter" | "document";
  overdue: boolean;
};

export default async function CalendarPage(props: PageProps<"/calendar">) {
  await requireUser();
  const params = await props.searchParams;
  const today = startOfToday();
  const month = clampMonth(single(params.month), today);
  const projectId = single(params.projectId) ?? "";

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const range = { gte: monthStart, lte: endOfDay(monthEnd) };
  const scope = projectId ? { projectId } : {};

  const [tasks, letters, documents, projects] = await Promise.all([
    prisma.task.findMany({
      where: { ...scope, dueDate: range },
      include: { assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.letter.findMany({
      where: { ...scope, dueDate: range },
      include: { counterparty: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.document.findMany({
      where: { ...scope, dueDate: range },
      include: { counterparty: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.project.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const byDay = new Map<number, CalendarEvent[]>();
  const push = (date: Date | null, event: CalendarEvent) => {
    if (!date) return;
    const day = date.getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  };

  for (const task of tasks) {
    push(task.dueDate, {
      id: task.id,
      href: `/tasks/${task.id}`,
      label: task.title,
      kind: "task",
      overdue: !CLOSED_TASK_STATUSES.includes(task.status as never) && task.dueDate! < today,
    });
  }
  for (const letter of letters) {
    push(letter.dueDate, {
      id: letter.id,
      href: `/letters/${letter.id}`,
      label: `№ ${letter.number}${letter.counterparty ? ` · ${letter.counterparty.name}` : ""}`,
      kind: "letter",
      overdue:
        !CLOSED_LETTER_STATUSES.includes(letter.status as never) && letter.dueDate! < today,
    });
  }
  for (const document of documents) {
    push(document.dueDate, {
      id: document.id,
      href: `/documents/${document.id}`,
      label: document.title,
      kind: "document",
      overdue: document.status !== "SIGNED" && document.dueDate! < today,
    });
  }

  const cells = buildMonthGrid(monthStart, monthEnd);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const query = projectId ? `&projectId=${projectId}` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Календарь сроков</h1>
          <p className="text-sm text-gray-500">
            Задачи, письма и документы, у которых срок приходится на этот месяц
          </p>
        </div>
        <form className="flex items-end gap-2">
          <input type="hidden" name="month" value={monthKey(month)} />
          <label className="field">
            Проект
            <select name="projectId" defaultValue={projectId} className="input w-56">
              <option value="">Все проекты</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-secondary">
            Показать
          </button>
        </form>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={`/calendar?month=${monthKey(previous)}${query}`} className="btn-secondary">
          ← {MONTHS[previous.getMonth()]}
        </Link>
        <h2 className="text-lg font-semibold text-gray-900">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </h2>
        <Link href={`/calendar?month=${monthKey(next)}${query}`} className="btn-secondary">
          {MONTHS[next.getMonth()]} →
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            const events = day === null ? [] : (byDay.get(day) ?? []);
            const isToday =
              day !== null &&
              today.getDate() === day &&
              today.getMonth() === month.getMonth() &&
              today.getFullYear() === month.getFullYear();

            return (
              <div
                key={index}
                className={`min-h-28 border-r border-b border-gray-100 p-1.5 ${
                  day === null ? "bg-gray-50" : ""
                }`}
              >
                {day !== null && (
                  <>
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                        isToday ? "bg-gray-900 font-semibold text-white" : "text-gray-500"
                      }`}
                    >
                      {day}
                    </span>
                    <ul className="mt-1 space-y-1">
                      {events.slice(0, 4).map((event) => (
                        <li key={`${event.kind}-${event.id}`}>
                          <Link
                            href={event.href}
                            title={event.label}
                            className={`block truncate rounded px-1 py-0.5 text-xs ${eventClass(event)}`}
                          >
                            {event.label}
                          </Link>
                        </li>
                      ))}
                      {events.length > 4 && (
                        <li className="px-1 text-xs text-gray-400">ещё {events.length - 4}</li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <Legend className="bg-sky-100 text-sky-800" label="задача" />
        <Legend className="bg-indigo-100 text-indigo-800" label="письмо" />
        <Legend className="bg-violet-100 text-violet-800" label="документ" />
        <Legend className="bg-red-100 text-red-800" label="просрочено" />
      </div>

      <p className="text-sm text-gray-500">
        Всего в этом месяце: задач {tasks.length}, писем {letters.length}, документов{" "}
        {documents.length}. Ближайший срок —{" "}
        {nearest([...tasks, ...letters, ...documents].map((item) => item.dueDate))}.
      </p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function eventClass(event: CalendarEvent): string {
  if (event.overdue) return "bg-red-100 text-red-800 hover:bg-red-200";
  if (event.kind === "letter") return "bg-indigo-100 text-indigo-800 hover:bg-indigo-200";
  if (event.kind === "document") return "bg-violet-100 text-violet-800 hover:bg-violet-200";
  return "bg-sky-100 text-sky-800 hover:bg-sky-200";
}

/** Сетка месяца с понедельника: null — пустая клетка до первого или после последнего дня. */
function buildMonthGrid(monthStart: Date, monthEnd: Date): (number | null)[] {
  const leading = (monthStart.getDay() + 6) % 7;
  const cells: (number | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= monthEnd.getDate(); day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function clampMonth(value: string | undefined, fallback: Date): Date {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!match) return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function nearest(dates: (Date | null)[]): string {
  const future = dates
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return future ? formatDate(future) : "нет";
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
