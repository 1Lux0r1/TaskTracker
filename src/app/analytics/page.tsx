import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  CLOSED_LETTER_STATUSES,
  CLOSED_TASK_STATUSES,
  DOCUMENT_STAGE_ORDER,
  TASK_STATUS_LABELS,
  daysUntil,
  documentStatusLabel,
  plural,
  startOfToday,
  type TaskStatus,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";
import { TrendChart } from "@/components/trend-chart";
import { Block, toneStyle, type Tone } from "@/components/ui";
import { TREND_RANGES, buildTrend, readTrendWeeks, trendDates } from "@/lib/trend";

export const dynamic = "force-dynamic";

/** Стадии задачи на полосе трека, слева направо: от «не начато» к «готово». */
const TRACK_STAGES: { status: TaskStatus; color: string }[] = [
  { status: "NEW", color: "#dde6f6" },
  { status: "BACKLOG", color: "#a9c1ec" },
  { status: "TODO", color: "#5f8ee0" },
  { status: "IN_PROGRESS", color: "#2a4f9e" },
  { status: "REVIEW", color: "#15875f" },
  { status: "DONE", color: "#c7d1e3" },
];

const COLOR = {
  onTime: "#5f8ee0",
  late: "#d23b33",
  open: "#3f6fd8",
  closed: "#a9c1ec",
  signing: "#15875f",
  declined: "#d23b33",
};

/** Документ считается подписанным, когда матрица сошлась или он уже в деле. */
const SIGNED_DOCUMENT_STATUSES = ["SIGNED", "FILED"];
const CLOSED_DOCUMENT_STATUSES = [...SIGNED_DOCUMENT_STATUSES, "DECLINED"];

export default async function AnalyticsPage(props: PageProps<"/analytics">) {
  await requireUser();
  const params = await props.searchParams;
  const projectId = single(params.projectId) ?? "";
  const weeks = readTrendWeeks(single(params.weeks));

  const scope = projectId ? { projectId } : {};
  const today = startOfToday();

  const [projects, tasks, letters, documents] = await Promise.all([
    prisma.project.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.task.findMany({
      where: scope,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        completedAt: true,
        assigneeId: true,
        assignee: { select: { fullName: true } },
        track: { select: { name: true } },
      },
    }),
    prisma.letter.findMany({
      where: scope,
      select: {
        id: true,
        subject: true,
        number: true,
        status: true,
        dueDate: true,
        closedAt: true,
        counterpartyId: true,
        counterparty: { select: { name: true } },
      },
    }),
    prisma.document.findMany({
      where: scope,
      select: {
        id: true,
        title: true,
        status: true,
        statusNote: true,
        dueDate: true,
        signedAt: true,
        owner: { select: { fullName: true } },
        counterparty: { select: { name: true } },
      },
    }),
  ]);

  const taskOpen = (status: string) => !CLOSED_TASK_STATUSES.includes(status as TaskStatus);
  const letterOpen = (status: string) => !CLOSED_LETTER_STATUSES.includes(status as never);
  const documentOpen = (status: string) => !CLOSED_DOCUMENT_STATUSES.includes(status);
  const late = (dueDate: Date | null) => dueDate !== null && daysUntil(dueDate, today) < 0;

  const openTasks = tasks.filter((task) => taskOpen(task.status));
  const lateTasks = openTasks.filter((task) => late(task.dueDate));
  const openLetters = letters.filter((letter) => letterOpen(letter.status));
  const lateLetters = openLetters.filter((letter) => late(letter.dueDate));
  const undated =
    openTasks.filter((task) => !task.dueDate).length +
    openLetters.filter((letter) => !letter.dueDate).length;
  const signed = documents.filter((document) => SIGNED_DOCUMENT_STATUSES.includes(document.status));
  const oldestLate = Math.max(0, ...lateTasks.map((task) => -daysUntil(task.dueDate!, today)));

  // Где стоит работа: у проектов треки свои, одинаковые названия складываем.
  const trackRows = groupRows(
    tasks.filter((task) => task.status !== "CANCELLED"),
    (task) => task.track?.name ?? "Без трека",
  ).map(([label, items]) => ({
    label,
    href: `/tasks?track=${encodeURIComponent(label)}&view=list`,
    segments: TRACK_STAGES.map((stage) => ({
      color: stage.color,
      title: TASK_STATUS_LABELS[stage.status],
      value: items.filter((task) => task.status === stage.status).length,
    })),
  }));

  // Кто перегружен: открытые задачи на человека, просроченные красным.
  const loadRows = groupRows(openTasks, (task) => task.assigneeId ?? "").map(([id, items]) => ({
    label: items[0].assignee?.fullName ?? "не назначен",
    href: id ? `/tasks?assigneeId=${id}&view=list` : undefined,
    warn: !id,
    segments: [
      { color: COLOR.late, title: "Просрочено", value: items.filter((task) => late(task.dueDate)).length },
      { color: COLOR.onTime, title: "В срок", value: items.filter((task) => !late(task.dueDate)).length },
    ],
  }));

  // С кем переписка не закрыта: сначала те, где больше открытых писем.
  const letterRows = groupRows(
    letters.filter((letter) => letter.counterpartyId),
    (letter) => letter.counterpartyId!,
  )
    .map(([id, items]) => ({
      label: items[0].counterparty?.name ?? "—",
      href: `/letters?counterpartyId=${id}`,
      segments: [
        { color: COLOR.open, title: "В работе", value: items.filter((l) => letterOpen(l.status)).length },
        { color: COLOR.closed, title: "Закрыто", value: items.filter((l) => !letterOpen(l.status)).length },
      ],
    }))
    .sort((a, b) => b.segments[0].value - a.segments[0].value || total(b) - total(a))
    .slice(0, 6);

  // Где стоит подписание: стадии в порядке списка документов.
  const stageRows = DOCUMENT_STAGE_ORDER.map((status) => ({
    label: documentStatusLabel(status),
    href: `/documents?status=${status}`,
    segments: [
      {
        color: status === "DECLINED" ? COLOR.declined : COLOR.signing,
        title: documentStatusLabel(status),
        value: documents.filter((document) => document.status === status).length,
      },
    ],
  })).filter((row) => total(row) > 0);
  const declined = documents.filter((document) => document.status === "DECLINED");

  // Что горит: всё просроченное одной лентой, самое старое сверху.
  const burning = [
    ...lateTasks.map((task) => ({
      key: `t${task.id}`,
      href: `/tasks/${task.id}`,
      title: task.title,
      meta: ["Задача", task.assignee?.fullName ?? "не назначен"],
      days: -daysUntil(task.dueDate!, today),
    })),
    ...lateLetters.map((letter) => ({
      key: `l${letter.id}`,
      href: `/letters/${letter.id}`,
      title: letter.subject,
      meta: ["Письмо", `№ ${letter.number}`, letter.counterparty?.name],
      days: -daysUntil(letter.dueDate!, today),
    })),
    ...documents
      .filter((document) => documentOpen(document.status) && late(document.dueDate))
      .map((document) => ({
        key: `d${document.id}`,
        href: `/documents/${document.id}`,
        title: document.title,
        meta: ["Документ", document.owner?.fullName ?? document.counterparty?.name],
        days: -daysUntil(document.dueDate!, today),
      })),
  ].sort((a, b) => b.days - a.days);

  // Динамика считается из самих записей: снимков система не ведёт, но у
  // задачи есть дата закрытия, а у письма — дата исполнения.
  const dates = trendDates(today, weeks);
  const taskTrend = buildTrend(
    tasks.map((task) => ({ dueDate: task.dueDate, closedAt: task.completedAt })),
    dates,
  );
  const letterTrend = buildTrend(
    letters.map((letter) => ({ dueDate: letter.dueDate, closedAt: letter.closedAt })),
    dates,
  );
  // Просрочки складываем: человеку важно, сколько всего горит, а не где.
  const overdueTrend = taskTrend.map((point, index) => ({
    ...point,
    overdue: point.overdue + (letterTrend[index]?.overdue ?? 0),
  }));
  const documentTrend = buildTrend(
    documents.map((document) => ({ dueDate: document.dueDate, closedAt: document.signedAt })),
    dates,
  );
  const signingDated = documents.some((document) => document.signedAt !== null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-[25px] leading-tight font-bold text-gray-900">Аналитика по проекту</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
            Пять вопросов, которые задают на планёрке: где стоит работа, кто перегружен, с кем
            переписка не закрыта, где стоит подписание и что горит.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <select
            name="projectId"
            defaultValue={projectId}
            className="input w-auto max-w-64"
            aria-label="Проект"
          >
            <option value="">Все проекты</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
          <select
            name="weeks"
            defaultValue={String(weeks)}
            className="input w-auto"
            aria-label="Период динамики"
          >
            {TREND_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                Период: {range.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Показать
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi tone="brand" value={openTasks.length} label="Задач в работе" sub={`из ${tasks.length} всего`} />
        <Kpi
          tone="bad"
          value={lateTasks.length}
          label="Задач просрочено"
          sub={
            lateTasks.length > 0
              ? `самая старая: ${oldestLate} дн. · писем: ${lateLetters.length}`
              : `писем просрочено: ${lateLetters.length}`
          }
        />
        <Kpi tone="copper" value={undated} label="Без срока" sub="задачи и письма в работе" />
        <Kpi
          tone="good"
          value={`${signed.length} / ${documents.length}`}
          label="Документов подписано"
          sub="всеми сторонами"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block tone="brand" icon="chart" title="Где стоит работа" sub="Задачи по трекам, оттенок — стадия">
          <Legend
            items={TRACK_STAGES.map((stage) => ({
              color: stage.color,
              label: TASK_STATUS_LABELS[stage.status],
            }))}
          />
          <StackBars rows={trackRows} />
          <Foot>Светлая часть слева — то, к чему ещё не приступали.</Foot>
        </Block>

        <Block tone="violet" icon="users" title="Кто перегружен" sub="Открытые задачи на человека">
          <Legend
            items={[
              { color: COLOR.onTime, label: "В срок" },
              { color: COLOR.late, label: "Просрочено" },
            ]}
          />
          <StackBars rows={loadRows} />
          <Foot>Строка «не назначен» — задачи, за которые никто не отвечает.</Foot>
        </Block>

        <Block tone="copper" icon="mail" title="С кем переписка не закрыта" sub="Письма по контрагентам">
          <Legend
            items={[
              { color: COLOR.open, label: "В работе" },
              { color: COLOR.closed, label: "Закрыто" },
            ]}
          />
          <StackBars rows={letterRows} />
          <Foot>
            {letterRows.length > 0
              ? `${letterRows.length} ${plural(letterRows.length, "контрагент", "контрагента", "контрагентов")} с самой активной перепиской.`
              : "Писем с контрагентом пока нет."}
          </Foot>
        </Block>

        <Block tone="good" icon="flow" title="Где стоит подписание" sub="Сколько документов на каждой стадии">
          <StackBars rows={stageRows} />
          <Foot>
            Всего документов в работе: {documents.filter((d) => documentOpen(d.status)).length}.
          </Foot>
          {declined.length > 0 && (
            <ul className="mt-2 space-y-1 text-[13px]">
              {declined.map((document) => (
                <li key={document.id} className="text-red-600">
                  Отказ:{" "}
                  <Link href={`/documents/${document.id}`} className="font-medium hover:underline">
                    {document.title}
                  </Link>
                  {document.statusNote && <span className="text-gray-500"> — {document.statusNote}</span>}
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      <Block
        tone="bad"
        icon="alert"
        title="Что горит прямо сейчас"
        sub="Собирается само из задач, писем и документов"
        flush
      >
        {burning.length === 0 ? (
          <p className="px-[18px] pb-[18px] text-sm text-gray-500">Просроченного нет.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border-t border-gray-200">
            {burning.slice(0, 12).map((item) => (
              <li key={item.key} className="relative flex items-center gap-4 px-[18px] py-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <Link
                    href={item.href}
                    className="block truncate text-[14.5px] text-gray-900 after:absolute after:inset-0 after:content-['']"
                  >
                    {item.title}
                  </Link>
                  <p className="truncate text-[12.5px] text-gray-500">
                    {item.meta.filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="font-mono text-[13px] whitespace-nowrap text-red-600">
                  просрочка {item.days} дн.
                </span>
              </li>
            ))}
          </ul>
        )}
        {burning.length > 12 && (
          <p className="border-t border-gray-200 px-[18px] py-2.5 text-[13px] text-gray-500">
            И ещё {burning.length - 12}: полный список — в{" "}
            <Link href="/tasks?preset=overdue&view=list" className="font-medium text-brand hover:underline">
              задачах
            </Link>{" "}
            и{" "}
            <Link href="/letters?preset=overdue" className="font-medium text-brand hover:underline">
              письмах
            </Link>
            .
          </p>
        )}
      </Block>

      <Block tone="brand" icon="clock" title="Динамика" sub="Как менялись готовность и просрочки по неделям">
        <div className="grid gap-3 md:grid-cols-2">
          <TrendChart
            plain
            title="Готовность задач"
            points={taskTrend}
            pick={(point) => point.readiness}
            unit="%"
            ceiling={100}
            growthIsGood
          />
          <TrendChart
            plain
            title="Просрочено задач и писем"
            points={overdueTrend}
            pick={(point) => point.overdue}
            growthIsGood={false}
          />
          {/* В загруженных реестрах подписания нет дат: у документов из Excel
              стоит статус «Подписан», но не день. График появится, когда
              подписания начнут отмечать в системе, — рисовать «0 подписано»
              рядом с двумя десятками подписанных было бы враньём. */}
          {signingDated && (
            <div className="md:col-span-2">
              <TrendChart
                plain
                title="Подписано документов"
                points={documentTrend}
                pick={(point) => point.done}
                growthIsGood
              />
            </div>
          )}
        </div>
        <Foot>
          Прошлое считается из самих записей: видно, что к каждой неделе было закрыто и что уже
          просрочено. Состав работ при этом берётся сегодняшний — в загруженных из Excel реестрах нет
          дат заведения строк.
        </Foot>
      </Block>
    </div>
  );
}

const KPI_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  bad: "text-red-600",
  copper: "text-copper",
  good: "text-green-600",
  violet: "text-purple-600",
};

function Kpi({
  tone,
  value,
  label,
  sub,
}: {
  tone: Tone;
  value: number | string;
  label: string;
  sub: string;
}) {
  return (
    <div
      style={{
        ...toneStyle(tone),
        backgroundImage: "linear-gradient(135deg, var(--accent-soft), transparent 70%)",
      }}
      className="card card-accent min-w-0 px-[18px] pt-4 pb-[15px]"
    >
      <p className={`font-display text-[28px] leading-none font-bold tabular-nums ${KPI_TEXT[tone]}`}>
        {value}
      </p>
      <p className="mt-2 text-[13.5px] text-gray-900">{label}</p>
      <p className="mt-0.5 truncate text-[12.5px] text-gray-500">{sub}</p>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px] text-gray-600">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <i aria-hidden className="block size-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return <p className="mt-auto pt-4 text-[12.5px] text-gray-500">{children}</p>;
}

type BarRow = {
  label: string;
  href?: string;
  warn?: boolean;
  segments: { color: string; title: string; value: number }[];
};

function total(row: BarRow): number {
  return row.segments.reduce((sum, segment) => sum + segment.value, 0);
}

/**
 * Полосы из отрезков: длина — сколько всего, отрезки — из чего это
 * складывается. Шкала общая для всех строк карточки, чтобы строки
 * сравнивались между собой.
 */
function StackBars({ rows }: { rows: BarRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">Нет данных.</p>;
  const max = Math.max(...rows.map(total), 1);

  return (
    <ul className="space-y-2">
      {rows.map((row, index) => {
        const sum = total(row);
        return (
          <li
            key={`${row.label}-${index}`}
            className="grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)_2rem] items-center gap-3"
          >
            {row.href ? (
              <Link
                href={row.href}
                title={row.label}
                className={`truncate text-right text-[13px] hover:underline ${row.warn ? "text-red-600" : "text-gray-700"}`}
              >
                {row.label}
              </Link>
            ) : (
              <span
                title={row.label}
                className={`truncate text-right text-[13px] ${row.warn ? "text-red-600" : "text-gray-700"}`}
              >
                {row.label}
              </span>
            )}
            <span className="flex h-3.5 gap-[3px]" style={{ width: `${(sum / max) * 100}%` }}>
              {row.segments
                .filter((segment) => segment.value > 0)
                .map((segment) => (
                  <span
                    key={segment.title}
                    title={`${segment.title}: ${segment.value}`}
                    className="block h-full rounded-[3px]"
                    style={{ flexGrow: segment.value, flexBasis: 0, background: segment.color }}
                  />
                ))}
            </span>
            <span className="font-mono text-[12.5px] text-gray-500 tabular-nums">{sum}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Группировка с сортировкой по размеру группы: крупные сверху. */
function groupRows<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item);
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
