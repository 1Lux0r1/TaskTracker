import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildLetterWhere, readLetterFilter } from "@/lib/letter-filters";
import { buildTaskWhere, readTaskFilter } from "@/lib/task-filters";
import {
  CLOSED_LETTER_STATUSES,
  CLOSED_TASK_STATUSES,
  documentKindLabel,
  formatShortDate,
  plural,
  startOfToday,
} from "@/lib/domain";
import { greeting, greetingName } from "@/lib/today";
import { Block, DueTag, Icon, type IconName, type Tone, toneStyle } from "@/components/ui";
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
  /** Пилюля рядом с цифрой: «новых: 2»; заливается, когда есть что показать. */
  pill: string;
  pillOn: boolean;
  /** Полоса: просроченное красным, живое цветом раздела, закрытое серым. */
  bar: { late: number; live: number; rest: number };
  foot: React.ReactNode;
  tone: Tone;
  icon: IconName;
};

type ListRow = {
  id: string;
  href: string;
  label: string;
  note: string;
  right: React.ReactNode;
};

type ListBlock = {
  key: string;
  title: string;
  sub: string;
  href: string;
  tone: Tone;
  icon: IconName;
  empty: string;
  rows: ListRow[];
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
  const lateLetterWhere: Prisma.LetterWhereInput = {
    status: openLetters,
    dueDate: { lt: today },
  };
  // Карточка про документы на подписании целиком, а не только про наши
  // подписи: человеку важно видеть и то, что стоит на другой стороне.
  const signingWhere: Prisma.DocumentWhereInput = {
    signatures: { some: { status: "PENDING" } },
  };

  const [
    taskGroups,
    letterGroups,
    lateLetterCount,
    meetingTotal,
    overdueTasks,
    overdueTaskCount,
    waitingLetters,
    waitingLetterCount,
    signingDocuments,
    signingCount,
    nextMeetings,
    meetingsAhead,
  ] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], _count: true }),
    prisma.letter.groupBy({ by: ["status"], _count: true }),
    prisma.letter.count({ where: lateLetterWhere }),
    prisma.meeting.count(),
    prisma.task.findMany({
      where: overdueTaskWhere,
      include: { track: { select: { name: true } }, assignee: { select: { fullName: true } } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    prisma.task.count({ where: overdueTaskWhere }),
    prisma.letter.findMany({
      where: waitingLetterWhere,
      include: { counterparty: { select: { name: true } }, owner: { select: { fullName: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { date: "desc" }],
      take: 3,
    }),
    prisma.letter.count({ where: waitingLetterWhere }),
    prisma.document.findMany({
      where: signingWhere,
      include: {
        signatures: {
          where: { status: "PENDING" },
          select: { party: true, counterparty: { select: { isInternal: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { title: "asc" }],
      take: 3,
    }),
    prisma.document.count({ where: signingWhere }),
    prisma.meeting.findMany({
      where: { date: { gte: today } },
      include: {
        participants: {
          select: {
            externalName: true,
            member: { select: { fullName: true } },
            orgContact: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 3,
    }),
    prisma.meeting.count({ where: { date: { gte: today } } }),
  ]);

  const taskBy = new Map(taskGroups.map((group) => [group.status, group._count]));
  const letterBy = new Map(letterGroups.map((group) => [group.status, group._count]));
  const taskTotal = sum(taskBy);
  const taskClosed = CLOSED_TASK_STATUSES.reduce((total, status) => total + (taskBy.get(status) ?? 0), 0);
  const taskDone = taskBy.get("DONE") ?? 0;
  const taskNew = taskBy.get("NEW") ?? 0;
  const letterTotal = sum(letterBy);
  const letterClosed = CLOSED_LETTER_STATUSES.reduce(
    (total, status) => total + (letterBy.get(status) ?? 0),
    0,
  );
  const letterNew = letterBy.get("NEW") ?? 0;
  const nextMeeting = nextMeetings[0];

  const counters: CounterBlock[] = [
    {
      key: "tasks",
      title: "Задачи",
      href: "/tasks",
      tone: "brand",
      icon: "task",
      total: taskTotal,
      pill: taskNew > 0 ? `новых: ${taskNew}` : "новых нет",
      pillOn: taskNew > 0,
      bar: {
        late: overdueTaskCount,
        live: taskTotal - taskClosed - overdueTaskCount,
        rest: taskClosed,
      },
      foot: (
        <>
          в работе <b className="font-semibold text-gray-600">{taskBy.get("IN_PROGRESS") ?? 0}</b> ·
          просрочено <b className="font-semibold text-red-600">{overdueTaskCount}</b> · готово{" "}
          <b className="font-semibold text-gray-600">{taskDone}</b>
        </>
      ),
    },
    {
      key: "letters",
      title: "Письма ЭДО",
      href: "/letters",
      tone: "copper",
      icon: "mail",
      total: letterTotal,
      pill: letterNew > 0 ? `новых: ${letterNew}` : "новых нет",
      pillOn: letterNew > 0,
      bar: {
        late: lateLetterCount,
        live: letterTotal - letterClosed - lateLetterCount,
        rest: letterClosed,
      },
      foot: (
        <>
          ждут ответа <b className="font-semibold text-gray-600">{waitingLetterCount}</b> ·
          просрочено <b className="font-semibold text-red-600">{lateLetterCount}</b> · закрыто{" "}
          <b className="font-semibold text-gray-600">{letterClosed}</b>
        </>
      ),
    },
    {
      key: "meetings",
      title: "Встречи",
      href: "/meetings",
      tone: "violet",
      icon: "calendar",
      total: meetingTotal,
      pill: meetingsAhead > 0 ? `впереди: ${meetingsAhead}` : "впереди нет",
      pillOn: meetingsAhead > 0,
      bar: { late: 0, live: meetingsAhead, rest: meetingTotal - meetingsAhead },
      foot: nextMeeting ? (
        <>
          ближайшая{" "}
          <b className="font-semibold text-gray-600">
            {[formatShortDate(nextMeeting.date), nextMeeting.startTime].filter(Boolean).join(", ")}
          </b>
          {nextMeeting.place ? ` · ${nextMeeting.place}` : ""}
        </>
      ) : (
        "предстоящих встреч нет"
      ),
    },
  ];

  const lists: ListBlock[] = [
    {
      key: "overdue",
      title: "Просрочено",
      sub: "Требует решения в первую очередь",
      href: "/tasks?preset=overdue",
      tone: "bad",
      icon: "alert",
      empty: "Просроченных задач нет.",
      rows: overdueTasks.map((task) => ({
        id: task.id,
        href: `/tasks/${task.id}`,
        label: task.title,
        note: [task.track?.name, task.assignee?.fullName ?? "ответственный не назначен"]
          .filter(Boolean)
          .join(" · "),
        right: <DueTag date={task.dueDate} words />,
      })),
      more: overdueTaskCount - overdueTasks.length,
    },
    {
      key: "letters",
      title: "Письма без ответа",
      sub: "Мяч на нашей стороне",
      href: "/letters?preset=waitingUs",
      tone: "copper",
      icon: "mail",
      empty: "Писем, ждущих нашего ответа, нет.",
      rows: waitingLetters.map((letter) => ({
        id: letter.id,
        href: `/letters/${letter.id}`,
        label: letter.subject,
        note: [
          `№ ${letter.number}`,
          letter.counterparty?.name ?? "организация не указана",
          letter.owner?.fullName ?? "ответственный не назначен",
        ].join(" · "),
        right: <DueTag date={letter.dueDate} words />,
      })),
      more: waitingLetterCount - waitingLetters.length,
    },
    {
      key: "documents",
      title: "Документы на подписании",
      sub: "Видно, чьей подписи не хватает",
      href: "/documents",
      tone: "good",
      icon: "pen",
      empty: "Документов, ждущих подписи, нет.",
      rows: signingDocuments.map((document) => ({
        id: document.id,
        href: `/documents/${document.id}`,
        label: document.title,
        note: `${documentKindLabel(document.kind)} · ${waitingFor(document.signatures)}`,
        right: <DueTag date={document.dueDate} words />,
      })),
      more: signingCount - signingDocuments.length,
    },
    {
      key: "meetings",
      title: "Ближайшие встречи",
      sub: "Повестка и участники в карточке",
      href: "/meetings",
      tone: "violet",
      icon: "calendar",
      empty: "Предстоящих встреч нет.",
      rows: nextMeetings.map((meeting) => ({
        id: meeting.id,
        href: `/meetings/${meeting.id}`,
        label: meeting.subject,
        note: [meeting.place, participantNames(meeting.participants)].filter(Boolean).join(" · "),
        right: (
          <span className="font-mono text-[13px] whitespace-nowrap text-gray-900 tabular-nums">
            {[formatShortDate(meeting.date), meeting.startTime].filter(Boolean).join(" ")}
          </span>
        ),
      })),
      more: Math.max(meetingsAhead - nextMeetings.length, 0),
    },
  ];

  const waiting = waitingLetterCount;
  return (
    <div className="space-y-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-[25px] leading-tight font-bold text-gray-900">
            {greeting(now, greetingName(user.fullName, user.displayName))}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {capitalize(formatLongDay(today))}.{" "}
            {overdueTaskCount}{" "}
            {plural(overdueTaskCount, "задача просрочена", "задачи просрочены", "задач просрочено")},{" "}
            {waiting} {plural(waiting, "письмо ждёт", "письма ждут", "писем ждут")} ответа.
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

      <div className="grid gap-3.5 md:grid-cols-3">
        {counters.map((block) => (
          <Counter key={block.key} block={block} />
        ))}
      </div>

      {/* Карточек четыре, поэтому в два ряда по две — экран остаётся ровным. */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        {lists.map((block) => (
          <ListCard key={block.key} block={block} />
        ))}
      </div>

      <p className="text-[12.5px] text-gray-500">
        Сюда же будут выводиться настраиваемые дашборды — состав и настройка в бэклоге. Что
        дальше по срокам — в{" "}
        <Link href="/calendar" className="font-medium text-gray-900 hover:underline">
          календаре
        </Link>
        .
      </p>
    </div>
  );
}

function Counter({ block }: { block: CounterBlock }) {
  const { late, live, rest } = block.bar;
  const total = late + live + rest;
  const parts = [
    { key: "late", count: late, className: "bg-red-600" },
    { key: "live", count: live, className: "" },
    { key: "rest", count: rest, className: "bg-gray-200" },
  ].filter((part) => part.count > 0);

  // Плитка раздела из макета: полоса и подложка цветом раздела, значок
  // в цветном квадрате, крупная цифра тем же цветом и стрелка перехода.
  return (
    <Link
      href={block.href}
      style={toneStyle(block.tone)}
      className="card card-accent group relative flex min-w-0 flex-col px-[18px] pt-4 pb-[15px] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{ background: "linear-gradient(135deg, var(--accent-soft) 0%, transparent 62%)" }}
      />

      <div className="relative mb-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-8 flex-none place-items-center rounded-[10px] text-white"
          style={{ background: "var(--accent)" }}
        >
          <Icon name={block.icon} size={17} />
        </span>
        <span className="text-sm font-semibold text-gray-900">{block.title}</span>
        <span className="ml-auto text-base text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]">
          →
        </span>
      </div>

      <p className="relative flex flex-wrap items-baseline gap-2.5">
        <span
          className="font-display text-[38px] leading-none font-extrabold tracking-tight tabular-nums"
          style={{ color: "var(--accent)" }}
        >
          {block.total}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
            block.pillOn ? "text-white" : "border border-gray-200 bg-white text-gray-500"
          }`}
          style={block.pillOn ? { background: "var(--accent)" } : undefined}
        >
          {block.pill}
        </span>
      </p>

      <div aria-hidden className="relative mt-3.5 mb-2 flex h-1.5 gap-[3px]">
        {total === 0 ? (
          <i className="block w-full rounded-full bg-gray-200" />
        ) : (
          parts.map((part) => (
            <i
              key={part.key}
              className={`block min-w-1.5 rounded-full ${part.className}`}
              style={{
                width: `${(part.count / total) * 100}%`,
                background: part.className ? undefined : "var(--accent)",
              }}
            />
          ))
        )}
      </div>

      <p className="relative text-[12.5px] text-gray-500">{block.foot}</p>
    </Link>
  );
}

function ListCard({ block }: { block: ListBlock }) {
  return (
    <Block tone={block.tone} icon={block.icon} title={block.title} sub={block.sub} flush>
      {block.rows.length === 0 ? (
        <p className="px-[18px] pb-[18px] text-sm text-gray-500">{block.empty}</p>
      ) : (
        <ul className="border-t border-gray-100">
          {block.rows.map((row) => (
            <li key={row.id} className="border-b border-gray-100 last:border-b-0">
              {/* min-w-0: без него длинная тема письма растягивает карточку
                  и уводит страницу вбок на телефоне. */}
              <Link
                href={row.href}
                className="flex min-w-0 items-center gap-3.5 px-[18px] py-3 hover:bg-gray-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] leading-snug text-gray-900">{row.label}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-gray-500">{row.note}</span>
                </span>
                <span className="flex-none">{row.right}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {block.more > 0 && (
        <Link
          href={block.href}
          className="mx-[18px] mt-auto mb-4 self-start rounded-lg px-2.5 py-1 text-[12.5px] text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          Ещё {block.more}
        </Link>
      )}
    </Block>
  );
}

function sum(counts: Map<string, number>): number {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «пятница, 25 сентября» — так день назван в макете. */
function formatLongDay(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(
    date,
  );
}

function participantNames(
  participants: {
    externalName: string | null;
    member: { fullName: string } | null;
    orgContact: { fullName: string } | null;
  }[],
): string {
  return participants
    .map((item) => item.member?.fullName ?? item.orgContact?.fullName ?? item.externalName)
    .filter(Boolean)
    .join(", ");
}

/** Чьей подписи не хватает: своя сторона называется «нами», чужая — собой. */
function waitingFor(
  signatures: { party: string; counterparty: { isInternal: boolean } | null }[],
): string {
  if (signatures.length === 0) return "стороны не заданы";
  const names = signatures.map((signature) =>
    signature.counterparty?.isInternal ? "наша сторона" : signature.party,
  );
  return `ждём: ${[...new Set(names)].join(", ")}`;
}
