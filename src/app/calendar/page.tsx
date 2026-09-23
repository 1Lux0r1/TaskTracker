import Link from "next/link";
import { CalendarDayPanel } from "@/components/calendar-day-panel";
import { prisma } from "@/lib/db";
import {
  CALENDAR_TYPES,
  CALENDAR_VIEWS,
  type CalendarFilter,
  type CalendarType,
  buildMonthGrid,
  buildWeekDays,
  calendarHref,
  calendarRange,
  dayKey,
  durationSlice,
  isSameDay,
  readCalendarFilter,
  shiftCalendar,
  toggleType,
} from "@/lib/calendar";
import {
  CLOSED_LETTER_STATUSES,
  CLOSED_TASK_STATUSES,
  formatDate,
  formatMeetingTime,
  startOfToday,
  trackColor,
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
  type: CalendarType;
  href: string;
  label: string;
  note: string;
  date: Date;
  overdue: boolean;
};

/** Полоса задачи «от постановки до срока»: рисуется по дням месячной сетки. */
type DurationBar = {
  id: string;
  title: string;
  href: string;
  startDate: Date;
  dueDate: Date;
  dot: string;
};

const TYPE_CHIP: Record<CalendarType, string> = {
  task: "bg-sky-100 text-sky-800 hover:bg-sky-200",
  letter: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  document: "bg-violet-100 text-violet-800 hover:bg-violet-200",
  meeting: "bg-amber-100 text-amber-800 hover:bg-amber-200",
};

export default async function CalendarPage(props: PageProps<"/calendar">) {
  await requireUser();
  const params = await props.searchParams;
  const today = startOfToday();
  const filter = readCalendarFilter(params, today);
  const { start, end } = calendarRange(filter.view, filter.day);

  // Месячная сетка захватывает хвосты соседних месяцев, поэтому записи берём
  // по границам сетки, а не месяца: иначе первые дни были бы пустыми.
  const grid = filter.view === "week" ? buildWeekDays(filter.day) : buildMonthGrid(filter.day);
  const from = filter.view === "list" ? start : grid[0];
  const to = filter.view === "list" ? end : new Date(
    grid[grid.length - 1].getFullYear(),
    grid[grid.length - 1].getMonth(),
    grid[grid.length - 1].getDate(),
    23, 59, 59, 999,
  );

  const range = { gte: from, lte: to };
  const scope = filter.projectId ? { projectId: filter.projectId } : {};
  const wants = (type: CalendarType) => filter.types.includes(type);

  const [tasks, letters, documents, meetings, running, projects] = await Promise.all([
    wants("task")
      ? prisma.task.findMany({
          where: { ...scope, dueDate: range },
          include: { assignee: { select: { fullName: true } }, project: { select: { code: true } } },
          orderBy: { dueDate: "asc" },
        })
      : [],
    wants("letter")
      ? prisma.letter.findMany({
          where: { ...scope, dueDate: range },
          include: { counterparty: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
        })
      : [],
    wants("document")
      ? prisma.document.findMany({
          where: { ...scope, dueDate: range },
          include: { counterparty: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
        })
      : [],
    wants("meeting")
      ? prisma.meeting.findMany({
          where: { ...scope, date: range },
          include: { project: { select: { code: true } } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        })
      : [],
    // Полосы длительности: задача могла начаться до периода и кончиться после.
    filter.showDuration && filter.view === "month" && wants("task")
      ? prisma.task.findMany({
          where: {
            ...scope,
            startDate: { not: null, lte: to },
            dueDate: { not: null, gte: from },
          },
          include: { track: { select: { color: true } } },
          orderBy: { startDate: "asc" },
          take: 60,
        })
      : [],
    prisma.project.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      href: `/tasks/${task.id}`,
      label: task.title,
      note: `${task.project.code} · ${task.assignee?.fullName ?? "без ответственного"}`,
      date: task.dueDate!,
      overdue: !CLOSED_TASK_STATUSES.includes(task.status as never) && task.dueDate! < today,
    })),
    ...letters.map((letter) => ({
      id: letter.id,
      type: "letter" as const,
      href: `/letters/${letter.id}`,
      label: `№ ${letter.number}`,
      note: letter.counterparty?.name ?? letter.subject,
      date: letter.dueDate!,
      overdue:
        !CLOSED_LETTER_STATUSES.includes(letter.status as never) && letter.dueDate! < today,
    })),
    ...documents.map((document) => ({
      id: document.id,
      type: "document" as const,
      href: `/documents/${document.id}`,
      label: document.title,
      note: document.counterparty?.name ?? "",
      date: document.dueDate!,
      overdue: document.status !== "SIGNED" && document.dueDate! < today,
    })),
    ...meetings.map((meeting) => ({
      id: meeting.id,
      type: "meeting" as const,
      href: `/meetings/${meeting.id}`,
      label: meeting.subject,
      note: [formatMeetingTime(meeting.startTime, meeting.endTime), meeting.place]
        .filter(Boolean)
        .join(" · "),
      date: meeting.date,
      overdue: false,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.date);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  const bars: DurationBar[] = running.map((task) => ({
    id: task.id,
    title: task.title,
    href: `/tasks/${task.id}`,
    startDate: task.startDate!,
    dueDate: task.dueDate!,
    dot: trackColor(task.track.color).dot,
  }));

  const counts: Record<CalendarType, number> = {
    task: tasks.length,
    letter: letters.length,
    document: documents.length,
    meeting: meetings.length,
  };

  const selectedEvents = byDay.get(dayKey(filter.day)) ?? [];
  const periodTitle =
    filter.view === "week"
      ? `${formatDate(grid[0])} — ${formatDate(grid[6])}`
      : `${MONTHS[filter.day.getMonth()]} ${filter.day.getFullYear()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Календарь</h1>
          <p className="text-sm text-gray-500">
            Сроки задач, писем и документов и дни встреч в одной сетке
          </p>
        </div>
        {/* Режим — ссылками, а не формой: он должен оставаться в адресе. */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {CALENDAR_VIEWS.map((view) => (
            <Link
              key={view.value}
              href={calendarHref(filter, { view: view.value })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                filter.view === view.value
                  ? "bg-gray-900 font-medium text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {view.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <Link
            href={calendarHref(filter, { day: shiftCalendar(filter.view, filter.day, -1) })}
            aria-label="Предыдущий период"
            className="btn-secondary"
          >
            ←
          </Link>
          <Link
            href={calendarHref(filter, { day: shiftCalendar(filter.view, filter.day, 1) })}
            aria-label="Следующий период"
            className="btn-secondary"
          >
            →
          </Link>
          <Link href={calendarHref(filter, { day: today })} className="btn-secondary">
            Сегодня
          </Link>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{periodTitle}</h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {CALENDAR_TYPES.map((type) => {
            const on = filter.types.includes(type.value);
            return (
              <Link
                key={type.value}
                href={calendarHref(filter, { types: toggleType(filter.types, type.value) })}
                className={`badge ${on ? TYPE_CHIP[type.value] : "bg-gray-100 text-gray-400"}`}
              >
                {type.label}
                <span className="ml-1.5 tabular-nums">{on ? counts[type.value] : "—"}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-end gap-2">
          <input type="hidden" name="view" value={filter.view} />
          <input type="hidden" name="day" value={dayKey(filter.day)} />
          <input type="hidden" name="types" value={filter.types.join(",")} />
          {filter.showDuration && <input type="hidden" name="duration" value="1" />}
          <label className="field">
            Проект
            <select name="projectId" defaultValue={filter.projectId} className="input w-56">
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

        {filter.view === "month" && filter.types.includes("task") && (
          <Link
            href={calendarHref(filter, { showDuration: !filter.showDuration })}
            className={`badge ${
              filter.showDuration ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            Показать длительность задач
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {filter.view === "month" && (
            <MonthGrid
              filter={filter}
              grid={grid}
              byDay={byDay}
              bars={bars}
              today={today}
            />
          )}
          {filter.view === "week" && <WeekGrid filter={filter} grid={grid} byDay={byDay} today={today} />}
          {filter.view === "list" && <EventList filter={filter} events={events} today={today} />}
        </div>

        <CalendarDayPanel
          title={longDate(filter.day)}
          isToday={isSameDay(filter.day, today)}
          day={dayKey(filter.day)}
          projectId={filter.projectId}
          events={selectedEvents.map((event) => ({
            id: `${event.type}-${event.id}`,
            href: event.href,
            label: event.label,
            note: event.note,
            chip: event.overdue ? "bg-red-100 text-red-800" : TYPE_CHIP[event.type],
            type: typeLabel(event.type),
          }))}
        />
      </div>
    </div>
  );
}

function MonthGrid({
  filter,
  grid,
  byDay,
  bars,
  today,
}: {
  filter: CalendarFilter;
  grid: Date[];
  byDay: Map<string, CalendarEvent[]>;
  bars: DurationBar[];
  today: Date;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="px-2 py-2 text-center text-xs font-semibold text-gray-500">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((date) => {
          const events = byDay.get(dayKey(date)) ?? [];
          const otherMonth = date.getMonth() !== filter.day.getMonth();
          const selected = isSameDay(date, filter.day);
          const slices = bars
            .map((bar) => ({ bar, slice: durationSlice(bar, date) }))
            .filter((item) => item.slice.visible)
            .slice(0, 3);

          return (
            <div
              key={dayKey(date)}
              className={`min-h-28 border-r border-b border-gray-100 p-1.5 ${
                otherMonth ? "bg-gray-50" : ""
              } ${selected ? "ring-2 ring-inset ring-gray-900" : ""}`}
            >
              <Link
                href={calendarHref(filter, { day: date })}
                className={`inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                  isSameDay(date, today)
                    ? "bg-gray-900 font-semibold text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {date.getDate()}
              </Link>

              {/* Полосы выходят за поля ячейки, чтобы соседние дни сливались
                  в одну линию, а не в пунктир. */}
              {slices.length > 0 && (
                <div className="-mx-1.5 mt-1 space-y-0.5">
                  {slices.map(({ bar, slice }) => (
                    <Link
                      key={bar.id}
                      href={bar.href}
                      title={bar.title}
                      className={`block h-4 overflow-hidden px-1 text-[10px] leading-4 text-white ${bar.dot} ${
                        slice.first ? "rounded-l-full" : ""
                      } ${slice.last ? "rounded-r-full" : ""}`}
                    >
                      {/* Подпись — в начале полосы и в начале каждой недели:
                          иначе полоса, начавшаяся в прошлом месяце, безымянна. */}
                      {slice.first || date.getDay() === 1 ? (
                        <span className="block truncate">{bar.title}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}

              <ul className="mt-1 space-y-1">
                {events.slice(0, 4).map((event) => (
                  <li key={`${event.type}-${event.id}`}>
                    <Link
                      href={event.href}
                      title={`${typeLabel(event.type)}: ${event.label}`}
                      className={`block truncate rounded px-1 py-0.5 text-xs ${
                        event.overdue ? "bg-red-100 text-red-800 hover:bg-red-200" : TYPE_CHIP[event.type]
                      }`}
                    >
                      {event.label}
                    </Link>
                  </li>
                ))}
                {events.length > 4 && (
                  <li>
                    <Link
                      href={calendarHref(filter, { day: date })}
                      className="block px-1 text-xs text-gray-400 hover:text-gray-600"
                    >
                      ещё {events.length - 4}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  filter,
  grid,
  byDay,
  today,
}: {
  filter: CalendarFilter;
  grid: Date[];
  byDay: Map<string, CalendarEvent[]>;
  today: Date;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {grid.map((date, index) => {
        const events = byDay.get(dayKey(date)) ?? [];
        const selected = isSameDay(date, filter.day);

        return (
          <div
            key={dayKey(date)}
            className={`card min-h-40 p-2 ${selected ? "ring-2 ring-gray-900" : ""}`}
          >
            <Link
              href={calendarHref(filter, { day: date })}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-xs font-semibold text-gray-500">{WEEKDAYS[index]}</span>
              <span
                className={`inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                  isSameDay(date, today)
                    ? "bg-gray-900 font-semibold text-white"
                    : "text-gray-500"
                }`}
              >
                {date.getDate()}
              </span>
            </Link>

            <ul className="mt-2 space-y-1">
              {events.map((event) => (
                <li key={`${event.type}-${event.id}`}>
                  <Link
                    href={event.href}
                    className={`block rounded px-1.5 py-1 text-xs ${
                      event.overdue ? "bg-red-100 text-red-800 hover:bg-red-200" : TYPE_CHIP[event.type]
                    }`}
                  >
                    <span className="block truncate font-medium">{event.label}</span>
                    {event.note && <span className="block truncate opacity-75">{event.note}</span>}
                  </Link>
                </li>
              ))}
              {events.length === 0 && <li className="px-1 text-xs text-gray-400">пусто</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function EventList({
  filter,
  events,
  today,
}: {
  filter: CalendarFilter;
  events: CalendarEvent[];
  today: Date;
}) {
  if (events.length === 0) {
    return <p className="card p-6 text-sm text-gray-500">В этом месяце записей нет.</p>;
  }

  const days = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.date);
    days.set(key, [...(days.get(key) ?? []), event]);
  }

  return (
    <ul className="space-y-2">
      {[...days.entries()].map(([key, dayEvents]) => (
        <li key={key} className="card p-4">
          <Link
            href={calendarHref(filter, { day: dayEvents[0].date })}
            className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 hover:underline"
          >
            {longDate(dayEvents[0].date)}
            {isSameDay(dayEvents[0].date, today) && (
              <span className="badge bg-gray-900 text-white">сегодня</span>
            )}
          </Link>
          <ul className="mt-2 divide-y divide-gray-100">
            {dayEvents.map((event) => (
              <li key={`${event.type}-${event.id}`} className="flex flex-wrap items-center gap-2 py-2">
                <span
                  className={`badge ${
                    event.overdue ? "bg-red-100 text-red-800" : TYPE_CHIP[event.type]
                  }`}
                >
                  {typeLabel(event.type)}
                </span>
                <Link href={event.href} className="text-sm text-gray-900 hover:underline">
                  {event.label}
                </Link>
                {event.note && <span className="text-sm text-gray-500">{event.note}</span>}
                {event.overdue && <span className="ml-auto text-sm text-red-700">просрочено</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** В подписи одной записи тип называется в единственном числе. */
const TYPE_SINGULAR: Record<CalendarType, string> = {
  task: "Задача",
  letter: "Письмо",
  document: "Документ",
  meeting: "Встреча",
};

function typeLabel(type: CalendarType): string {
  return TYPE_SINGULAR[type];
}

const LONG_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const LONG_WEEKDAYS = [
  "воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота",
];

function longDate(date: Date): string {
  return `${date.getDate()} ${LONG_MONTHS[date.getMonth()]}, ${LONG_WEEKDAYS[date.getDay()]}`;
}
