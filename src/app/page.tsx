import Link from "next/link";
import { prisma } from "@/lib/db";
import { buildDocumentWhere, readDocumentFilter } from "@/lib/document-filters";
import { buildLetterWhere, readLetterFilter } from "@/lib/letter-filters";
import { buildTaskWhere, readTaskFilter } from "@/lib/task-filters";
import {
  CLOSED_LETTER_STATUSES,
  CLOSED_TASK_STATUSES,
  LETTER_STATUS_LABELS,
  MEETING_KIND_LABELS,
  TASK_STATUS_LABELS,
  formatDate,
  formatMeetingTime,
  startOfToday,
} from "@/lib/domain";
import {
  type CountSegment,
  breakdownText,
  greeting,
  greetingName,
  segmentShares,
} from "@/lib/today";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * «Сегодня» собирается из одного списка блоков: сверху три счётчика, ниже
 * четыре карточки. Когда появится настройка дашбордов, менять придётся
 * только состав списка, а не разметку экрана.
 */
type CounterBlock = {
  key: string;
  title: string;
  href: string;
  total: number;
  totalLabel: string;
  pill: string;
  segments: CountSegment[];
};

type ListBlock = {
  key: string;
  title: string;
  href: string;
  linkLabel: string;
  empty: string;
  rows: { id: string; href: string; label: string; note: string; accent?: boolean }[];
  more: number;
};

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const today = startOfToday();
  const openTasks = { notIn: CLOSED_TASK_STATUSES };
  const openLetters = { notIn: CLOSED_LETTER_STATUSES };

  const overdueTaskWhere = buildTaskWhere(readTaskFilter({ preset: "overdue" }), today);
  const waitingLetterWhere = buildLetterWhere(readLetterFilter({ preset: "waitingUs" }), today);
  const signingWhere = buildDocumentWhere(readDocumentFilter({ waiting: "us" }));

  const [
    taskGroups,
    letterGroups,
    meetingGroups,
    meetingsToday,
    overdueTasks,
    overdueTaskCount,
    waitingLetters,
    waitingLetterCount,
    signingDocuments,
    signingCount,
    nextMeetings,
  ] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], where: { status: openTasks }, _count: true }),
    prisma.letter.groupBy({ by: ["status"], where: { status: openLetters }, _count: true }),
    prisma.meeting.groupBy({ by: ["kind"], where: { date: { gte: today } }, _count: true }),
    prisma.meeting.count({ where: { date: { gte: today, lt: new Date(today.getTime() + 86_400_000) } } }),
    prisma.task.findMany({
      where: overdueTaskWhere,
      include: { project: { select: { code: true } }, assignee: { select: { fullName: true } } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    prisma.task.count({ where: overdueTaskWhere }),
    prisma.letter.findMany({
      where: waitingLetterWhere,
      include: { counterparty: { select: { name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { date: "desc" }],
      take: 3,
    }),
    prisma.letter.count({ where: waitingLetterWhere }),
    prisma.document.findMany({
      where: signingWhere,
      include: { counterparty: { select: { name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { title: "asc" }],
      take: 3,
    }),
    prisma.document.count({ where: signingWhere }),
    prisma.meeting.findMany({
      where: { date: { gte: today } },
      include: { project: { select: { code: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 3,
    }),
  ]);

  const taskBy = countBy(taskGroups.map((group) => [group.status, group._count]));
  const letterBy = countBy(letterGroups.map((group) => [group.status, group._count]));
  const meetingBy = countBy(meetingGroups.map((group) => [group.kind, group._count]));
  const meetingsAhead = meetingGroups.reduce((sum, group) => sum + group._count, 0);

  const counters: CounterBlock[] = [
    {
      key: "tasks",
      title: "Задачи",
      href: "/tasks",
      total: sum(taskBy),
      totalLabel: "в работе",
      pill: `новых: ${taskBy.get("NEW") ?? 0}`,
      segments: [
        segment("NEW", TASK_STATUS_LABELS.NEW, taskBy, "bg-sky-400"),
        segment("BACKLOG", TASK_STATUS_LABELS.BACKLOG, taskBy, "bg-gray-300"),
        segment("TODO", TASK_STATUS_LABELS.TODO, taskBy, "bg-blue-400"),
        segment("IN_PROGRESS", TASK_STATUS_LABELS.IN_PROGRESS, taskBy, "bg-blue-600"),
        segment("REVIEW", TASK_STATUS_LABELS.REVIEW, taskBy, "bg-violet-500"),
      ],
    },
    {
      key: "letters",
      title: "Письма",
      href: "/letters",
      total: sum(letterBy),
      totalLabel: "в работе",
      pill: `новых: ${letterBy.get("NEW") ?? 0}`,
      segments: [
        segment("NEW", LETTER_STATUS_LABELS.NEW, letterBy, "bg-indigo-400"),
        segment("IN_PROGRESS", LETTER_STATUS_LABELS.IN_PROGRESS, letterBy, "bg-indigo-600"),
        segment("ON_APPROVAL", LETTER_STATUS_LABELS.ON_APPROVAL, letterBy, "bg-violet-500"),
      ],
    },
    {
      key: "meetings",
      title: "Встречи",
      href: "/meetings",
      total: meetingsAhead,
      totalLabel: "впереди",
      // У встречи нет «новой»: полезнее знать, сколько их сегодня.
      pill: `сегодня: ${meetingsToday}`,
      segments: Object.entries(MEETING_KIND_LABELS).map(([kind, label], index) =>
        segment(kind, label, meetingBy, MEETING_BARS[index % MEETING_BARS.length]),
      ),
    },
  ];

  const lists: ListBlock[] = [
    {
      key: "overdue",
      title: "Просрочено",
      href: "/tasks?preset=overdue",
      linkLabel: "Все просроченные задачи",
      empty: "Просроченных задач нет.",
      rows: overdueTasks.map((task) => ({
        id: task.id,
        href: `/tasks/${task.id}`,
        label: task.title,
        note: `${task.project.code} · срок ${formatDate(task.dueDate)} · ${
          task.assignee?.fullName ?? "без ответственного"
        }`,
        accent: true,
      })),
      more: overdueTaskCount - overdueTasks.length,
    },
    {
      key: "letters",
      title: "Письма без ответа",
      href: "/letters?preset=waitingUs",
      linkLabel: "Все письма, ждущие ответа",
      empty: "Писем, ждущих нашего ответа, нет.",
      rows: waitingLetters.map((letter) => ({
        id: letter.id,
        href: `/letters/${letter.id}`,
        label: `№ ${letter.number} · ${letter.subject}`,
        note: `${letter.counterparty?.name ?? "организация не указана"} · срок ${formatDate(
          letter.dueDate,
        )}`,
        accent: letter.dueDate !== null && letter.dueDate < today,
      })),
      more: waitingLetterCount - waitingLetters.length,
    },
    {
      key: "documents",
      title: "Документы на подписании",
      href: "/documents?waiting=us",
      linkLabel: "Весь юридический трек",
      empty: "Документов, ждущих нашей подписи, нет.",
      rows: signingDocuments.map((document) => ({
        id: document.id,
        href: `/documents/${document.id}`,
        label: document.title,
        note: `${document.counterparty?.name ?? "сторона не указана"} · срок ${formatDate(
          document.dueDate,
        )}`,
        accent: document.dueDate !== null && document.dueDate < today,
      })),
      more: signingCount - signingDocuments.length,
    },
    {
      key: "meetings",
      title: "Ближайшие встречи",
      href: "/meetings",
      linkLabel: "Все встречи",
      empty: "Предстоящих встреч нет.",
      rows: nextMeetings.map((meeting) => ({
        id: meeting.id,
        href: `/meetings/${meeting.id}`,
        label: meeting.subject,
        note: [
          formatDate(meeting.date),
          formatMeetingTime(meeting.startTime, meeting.endTime),
          meeting.place,
          meeting.project.code,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      more: Math.max(meetingsAhead - nextMeetings.length, 0),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {greeting(now, greetingName(user.fullName, user.displayName))}
          </h1>
          <p className="text-sm text-gray-500">
            Сегодня {formatDate(today)}. Встреч сегодня: {meetingsToday}, задач в работе:{" "}
            {sum(taskBy)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tasks/new" className="btn-primary">
            Новая задача
          </Link>
          <Link href="/letters/new" className="btn-secondary">
            Внести письмо
          </Link>
          <Link href="/meetings/new" className="btn-secondary">
            Новая встреча
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {counters.map((block) => (
          <Counter key={block.key} block={block} />
        ))}
      </div>

      {/* Карточек четыре, поэтому в два ряда по две — экран остаётся ровным. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {lists.map((block) => (
          <ListCard key={block.key} block={block} />
        ))}
      </div>

      <p className="text-sm text-gray-500">
        Что дальше по срокам — в{" "}
        <Link href="/calendar" className="font-medium text-gray-900 hover:underline">
          календаре
        </Link>
        , состояние проектов — в{" "}
        <Link href="/projects" className="font-medium text-gray-900 hover:underline">
          проектах
        </Link>
        .
      </p>
    </div>
  );
}

function Counter({ block }: { block: CounterBlock }) {
  const shares = segmentShares(block.segments);

  return (
    <Link
      href={block.href}
      className="card flex min-w-0 flex-col gap-3 p-5 transition hover:border-gray-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-500">{block.title}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums text-gray-900">{block.total}</span>
            <span className="text-sm text-gray-500">{block.totalLabel}</span>
          </p>
        </div>
        <span className="badge bg-gray-900 text-white">{block.pill}</span>
      </div>

      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
        {shares.map((share) => (
          <span
            key={share.key}
            title={`${share.label}: ${share.count}`}
            style={{ width: `${share.percent}%` }}
            className={share.bar}
          />
        ))}
      </div>

      <p className="text-sm text-gray-500">{breakdownText(block.segments)}</p>
    </Link>
  );
}

function ListCard({ block }: { block: ListBlock }) {
  // min-w-0: без него длинная тема письма растягивает карточку и уводит
  // страницу вбок на телефоне.
  return (
    <section className="card flex h-full min-w-0 flex-col p-5">
      <h2 className="text-sm font-semibold text-gray-900">{block.title}</h2>

      {block.rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{block.empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {block.rows.map((row) => (
            <li key={row.id} className="py-2">
              <Link href={row.href} className="block">
                <span
                  className={`block truncate text-sm ${
                    row.accent ? "font-medium text-red-700" : "text-gray-900"
                  } hover:underline`}
                >
                  {row.label}
                </span>
                <span className="block truncate text-sm text-gray-500">{row.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={block.href}
        className="mt-auto pt-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
      >
        {block.more > 0 ? `Ещё ${block.more}` : block.linkLabel}
      </Link>
    </section>
  );
}

const MEETING_BARS = [
  "bg-amber-400",
  "bg-amber-600",
  "bg-orange-400",
  "bg-yellow-500",
  "bg-gray-300",
];

function segment(
  key: string,
  label: string,
  counts: Map<string, number>,
  bar: string,
): CountSegment {
  return { key, label, count: counts.get(key) ?? 0, bar };
}

function countBy(pairs: [string, number][]): Map<string, number> {
  return new Map(pairs);
}

function sum(counts: Map<string, number>): number {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}
