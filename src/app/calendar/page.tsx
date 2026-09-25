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
  plural,
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

  // Лента показывает и просроченное, как бы далеко оно ни было: незакрытая
  // запись висит, пока её не закроют, и в октябре сентябрьская просрочка не
  // должна пропадать из виду. В сетке месяца и недели такого нет: там
  // показывается ровно выбранный период.
  const late = filter.view === "list";
  const taskWhere = late
    ? {
        ...scope,
        OR: [
          { dueDate: range },
          { status: { notIn: [...CLOSED_TASK_STATUSES] }, dueDate: { lt: today } },
        ],
      }
    : { ...scope, dueDate: range };
  const letterWhere = late
    ? {
        ...scope,
        OR: [
          { dueDate: range },
          { status: { notIn: [...CLOSED_LETTER_STATUSES] }, dueDate: { lt: today } },
        ],
      }
    : { ...scope, dueDate: range };
  const documentWhere = late
    ? { ...scope, OR: [{ dueDate: range }, { status: { not: "SIGNED" }, dueDate: { lt: today } }] }
    : { ...scope, dueDate: range };

  const [tasks, letters, documents, meetings, running, projects] = await Promise.all([
    wants("task")
      ? prisma.task.findMany({
          where: taskWhere,
          include: { assignee: { select: { fullName: true } }, project: { select: { code: true } } },
          orderBy: { dueDate: "asc" },
        })
      : [],
    wants("letter")
      ? prisma.letter.findMany({
          where: letterWhere,
          include: { counterparty: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
        })
      : [],
    wants("document")
      ? prisma.document.findMany({
          where: documentWhere,
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
      // В клетке дня видна тема, как в макете: по номеру письмо не узнать.
      label: letter.subject,
      note: [`№ ${letter.number}`, letter.counterparty?.name].filter(Boolean).join(" · "),
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
      overdue: !["SIGNED", "FILED", "DECLINED"].includes(document.status) && document.dueDate! < today,
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
      : filter.view === "list"
        ? `С ${formatDate(from)} и дальше`
        : `${MONTHS[filter.day.getMonth()]} ${filter.day.getFullYear()}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Календарь</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
            Сроки задач, писем и документов вместе со встречами. Слева период, справа — выбранный
            день целиком: что назначено и что можно завести.
          </p>
        </div>

        {/* Режим и период — ссылками, а не формой: они должны оставаться в адресе. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg">
            {CALENDAR_VIEWS.map((view) => (
              <Link
                key={view.value}
                href={calendarHref(filter, { view: view.value })}
                aria-current={filter.view === view.value ? "page" : undefined}
                className="seg-btn"
              >
                {view.label}
              </Link>
            ))}
          </div>
          {filter.view !== "list" && (
            <>
              <Link
                href={calendarHref(filter, { day: shiftCalendar(filter.view, filter.day, -1) })}
                aria-label="Предыдущий период"
                className="btn-secondary px-2.5 py-1"
              >
                ←
              </Link>
              <b className="font-display min-w-44 text-center text-[15px] font-semibold text-gray-900">
                {periodTitle}
              </b>
              <Link
                href={calendarHref(filter, { day: shiftCalendar(filter.view, filter.day, 1) })}
                aria-label="Следующий период"
                className="btn-secondary px-2.5 py-1"
              >
                →
              </Link>
              <Link href={calendarHref(filter, { day: today })} className="btn-secondary px-2.5 py-1">
                Сегодня
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CALENDAR_TYPES.map((type) => {
          const on = filter.types.includes(type.value);
          return (
            <Link
              key={type.value}
              href={calendarHref(filter, { types: toggleType(filter.types, type.value) })}
              data-on={on}
              className="fchip"
            >
              <span
                aria-hidden
                className="mr-[7px] size-2 flex-none rounded-[2px]"
                style={{ background: TYPE_DOT[type.value] }}
              />
              {type.label}
              <span className="fchip-n">{counts[type.value]}</span>
            </Link>
          );
        })}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {filter.view === "month" && filter.types.includes("task") && (
            <Link
              href={calendarHref(filter, { showDuration: !filter.showDuration })}
              data-on={filter.showDuration}
              className="fchip"
            >
              Показать длительность задач
            </Link>
          )}
          {/* Выбор проекта нужен, только когда проектов больше одного. */}
          {projects.length > 1 && (
            <form className="flex items-center gap-2">
              <input type="hidden" name="view" value={filter.view} />
              <input type="hidden" name="day" value={dayKey(filter.day)} />
              <input type="hidden" name="types" value={filter.types.join(",")} />
              {filter.showDuration && <input type="hidden" name="duration" value="1" />}
              <label className="sr-only" htmlFor="calendar-project">
                Проект
              </label>
              <select
                id="calendar-project"
                name="projectId"
                defaultValue={filter.projectId}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[13px] text-gray-600 outline-none focus:border-brand"
              >
                <option value="">Все проекты</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} — {project.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="fchip">
                Показать
              </button>
            </form>
          )}
        </div>
      </div>

      {/* В ленте панель дня не нужна: лента и так идёт по дням. */}
      <div
        className={
          filter.view === "list"
            ? ""
            : "grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_316px] lg:items-start"
        }
      >
        <div className="min-w-0">
          {filter.view === "month" && (
            <MonthGrid filter={filter} grid={grid} byDay={byDay} bars={bars} today={today} />
          )}
          {filter.view === "week" && (
            <WeekRows filter={filter} grid={grid} byDay={byDay} today={today} />
          )}
          {filter.view === "list" && <Agenda events={events} today={today} />}
        </div>

        {filter.view !== "list" && (
        <CalendarDayPanel
          title={`${filter.day.getDate()} ${LONG_MONTHS[filter.day.getMonth()]}`}
          note={dayNote(filter.day, today)}
          day={dayKey(filter.day)}
          projectId={filter.projectId}
          events={selectedEvents.map((event) => ({
            id: `${event.type}-${event.id}`,
            href: event.href,
            label: event.label,
            note: [typeLabel(event.type), event.note].filter(Boolean).join(" · "),
            dot: TYPE_DOT[event.type],
            overdue: event.overdue,
          }))}
        />
        )}
      </div>
    </div>
  );
}

/** Цвет метки записи по её виду — те же четыре цвета, что в макете. */
const TYPE_DOT: Record<CalendarType, string> = {
  task: "var(--color-blue-500)",
  letter: "var(--color-amber-500)",
  document: "var(--color-green-600)",
  meeting: "var(--color-purple-600)",
};

/**
 * Запись в клетке или в строке недели: нейтральная плашка с цветным
 * квадратом. Заливка цветом остаётся за просрочкой — иначе сетка рябит.
 */
function EventChip({ event, big = false }: { event: CalendarEvent; big?: boolean }) {
  return (
    <Link
      href={event.href}
      title={`${typeLabel(event.type)}: ${event.label}${event.note ? ` · ${event.note}` : ""}`}
      className={`${event.overdue ? "ev-chip ev-chip-over" : "ev-chip"} ${
        big ? "max-w-full px-2.5 py-[5px] text-[12.5px]" : ""
      }`}
    >
      {!event.overdue && (
        <span
          aria-hidden
          className="size-1.5 flex-none rounded-[2px]"
          style={{ background: TYPE_DOT[event.type] }}
        />
      )}
      <span className={big ? "min-w-0" : "truncate"}>{event.label}</span>
    </Link>
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
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="px-3 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-gray-500 uppercase"
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((date) => {
          const events = byDay.get(dayKey(date)) ?? [];
          const otherMonth = date.getMonth() !== filter.day.getMonth();
          const selected = isSameDay(date, filter.day);
          const isToday = isSameDay(date, today);
          const slices = bars
            .map((bar) => ({ bar, slice: durationSlice(bar, date) }))
            .filter((item) => item.slice.visible)
            .slice(0, 3);

          return (
            <div
              key={dayKey(date)}
              className={`flex min-h-27 flex-col gap-1 border-r border-b border-gray-200 p-2 nth-7n:border-r-0 ${
                otherMonth ? "bg-gray-100" : ""
              } ${selected ? "ring-2 ring-brand ring-inset" : ""}`}
            >
              <Link
                href={calendarHref(filter, { day: date })}
                className={
                  isToday
                    ? "self-start rounded-md bg-brand px-1.5 py-px font-mono text-[12.5px] font-semibold text-white"
                    : "self-start font-mono text-[12.5px] text-gray-500 hover:text-gray-900"
                }
              >
                {date.getDate()}
              </Link>

              {/* Полосы выходят за поля клетки, чтобы соседние дни сливались
                  в одну линию, а не в пунктир. */}
              {slices.length > 0 && (
                <div className="-mx-2 space-y-0.5">
                  {slices.map(({ bar, slice }) => (
                    <Link
                      key={bar.id}
                      href={bar.href}
                      title={bar.title}
                      className={`block h-4 overflow-hidden px-1.5 text-[10px] leading-4 text-white ${bar.dot} ${
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

              {events.slice(0, 3).map((event) => (
                <EventChip key={`${event.type}-${event.id}`} event={event} />
              ))}
              {events.length > 3 && (
                <Link
                  href={calendarHref(filter, { day: date })}
                  className="pl-1 text-[11px] text-gray-500 hover:text-gray-900"
                >
                  ещё {events.length - 3}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Неделя — строками: слева день покрупнее, справа всё, что на него пришлось. */
function WeekRows({
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
    <div className="flex flex-col gap-2.5">
      {grid.map((date, index) => {
        const events = byDay.get(dayKey(date)) ?? [];
        const selected = isSameDay(date, filter.day);
        const isToday = isSameDay(date, today);

        return (
          <div
            key={dayKey(date)}
            className={`card grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3.5 px-3.5 py-3 sm:grid-cols-[118px_minmax(0,1fr)] ${
              index > 4 ? "bg-gray-50" : ""
            } ${selected ? "ring-2 ring-brand ring-inset" : ""}`}
          >
            <Link href={calendarHref(filter, { day: date })} className="block">
              <b
                className={
                  isToday
                    ? "font-display inline-block rounded-md bg-brand px-2 py-px text-base font-semibold text-white"
                    : "font-display inline-block text-base font-semibold text-gray-900"
                }
              >
                {date.getDate()} {SHORT_MONTHS[date.getMonth()]}
              </b>
              <span className="mt-0.5 block text-xs text-gray-500">{WEEKDAY_NAMES[index]}</span>
            </Link>
            <div className="flex min-w-0 flex-wrap items-center gap-[7px]">
              {events.length > 0 ? (
                events.map((event) => (
                  <EventChip key={`${event.type}-${event.id}`} event={event} big />
                ))
              ) : (
                <span className="text-xs text-gray-500">ничего не назначено</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Лента: что впереди, по дням, и отдельной группой просроченное — оно не про
 * «что впереди» и в ленте по датам ушло бы в прошлое, где его не увидят.
 */
function Agenda({ events, today }: { events: CalendarEvent[]; today: Date }) {
  const overdue = events
    .filter((event) => event.overdue)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const ahead = events.filter((event) => !event.overdue);

  if (overdue.length === 0 && ahead.length === 0) {
    return <p className="card p-10 text-center text-sm text-gray-500">Впереди пусто.</p>;
  }

  return (
    <div className="card overflow-hidden">
      {overdue.length > 0 && (
        <>
          <GroupHead
            title="Просрочено"
            note={`${overdue.length} ${plural(overdue.length, "запись", "записи", "записей")}`}
          />
          {overdue.map((event) => (
            <AgendaRow key={`${event.type}-${event.id}`} event={event} today={today} />
          ))}
        </>
      )}

      {groupByDay(ahead).map(([key, dayEvents]) => {
        const date = dayEvents[0].date;
        const away = daysBetween(today, date);
        return (
          <div key={key}>
            <GroupHead
              title={`${date.getDate()} ${LONG_MONTHS[date.getMonth()]}`}
              note={WEEKDAY_NAMES[(date.getDay() + 6) % 7]}
              accent={away === 0 ? "сегодня" : away === 1 ? "завтра" : `через ${away} дн.`}
              today={away === 0}
            />
            {dayEvents.map((event) => (
              <AgendaRow key={`${event.type}-${event.id}`} event={event} today={today} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function GroupHead({
  title,
  note,
  accent,
  today = false,
}: {
  title: string;
  note: string;
  accent?: string;
  today?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 px-4 pt-3.5 pb-1.5 text-xs text-gray-500">
      <b className="font-display text-[15px] font-semibold text-gray-900">{title}</b>
      <span>{note}</span>
      {accent && <span className={today ? "font-semibold text-brand" : ""}>{accent}</span>}
    </div>
  );
}

function AgendaRow({ event, today }: { event: CalendarEvent; today: Date }) {
  const late = daysBetween(event.date, today);
  return (
    <Link
      href={event.href}
      className="flex items-center gap-3.5 border-t border-gray-200 px-4 py-3 hover:bg-gray-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] text-gray-900">{event.label}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <span
            aria-hidden
            className="size-2 flex-none rounded-[2px]"
            style={{ background: TYPE_DOT[event.type] }}
          />
          {typeLabel(event.type)}
          {event.note && <span>· {event.note}</span>}
        </span>
      </span>
      <span
        className={`flex-none font-mono text-[12.5px] whitespace-nowrap ${
          event.overdue ? "font-medium text-red-600" : "text-gray-500"
        }`}
      >
        {event.overdue ? `просрочено ${late} дн.` : formatDate(event.date)}
      </span>
    </Link>
  );
}

function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const days = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.date);
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days.entries()];
}

/** Полных суток между днями: обе даты уже приведены к полуночи. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
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

const SHORT_MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];
const LONG_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
/** Дни недели с понедельника — в том же порядке, что и сетка. */
const WEEKDAY_NAMES = [
  "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье",
];

/** Подпись под датой в панели дня: какой это день недели и насколько он далеко. */
function dayNote(day: Date, today: Date): string {
  const away = daysBetween(today, day);
  const when = away === 0 ? "сегодня" : away > 0 ? `через ${away} дн.` : `${-away} дн. назад`;
  return `${WEEKDAY_NAMES[(day.getDay() + 6) % 7]} · ${when}`;
}
