import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  CLOSED_LETTER_STATUSES,
  CLOSED_TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  documentStatusLabel,
  formatDate,
  letterDirectionLabel,
  startOfToday,
  taskTrackLabel,
  type TaskStatus,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage(props: PageProps<"/analytics">) {
  const params = await props.searchParams;
  const projectId = single(params.projectId) ?? "";

  const projects = await prisma.project.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  const scope = projectId ? { projectId } : {};
  const today = startOfToday();
  const monthAgo = new Date(today.getTime() - 30 * 86_400_000);
  const openTasks = { notIn: CLOSED_TASK_STATUSES };
  const openLetters = { notIn: CLOSED_LETTER_STATUSES };

  const [
    byStatus,
    byTrack,
    byAssignee,
    overdueTasks,
    closedLastMonth,
    lettersByDirection,
    overdueLetters,
    lettersByCounterparty,
    documentsByStatus,
    declinedDocuments,
    members,
  ] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["track"], where: scope, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { ...scope, status: openTasks },
      _count: { _all: true },
    }),
    prisma.task.count({ where: { ...scope, status: openTasks, dueDate: { lt: today } } }),
    prisma.task.count({
      where: { ...scope, status: { in: CLOSED_TASK_STATUSES }, completedAt: { gte: monthAgo } },
    }),
    prisma.letter.groupBy({ by: ["direction"], where: scope, _count: { _all: true } }),
    prisma.letter.count({ where: { ...scope, status: openLetters, dueDate: { lt: today } } }),
    prisma.letter.groupBy({
      by: ["counterpartyId"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.document.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.document.findMany({
      where: { ...scope, status: "DECLINED" },
      include: { counterparty: true },
    }),
    prisma.member.findMany({ select: { id: true, fullName: true } }),
  ]);

  const counterparties = await prisma.counterparty.findMany({
    select: { id: true, name: true },
  });
  const counterpartyName = new Map(counterparties.map((item) => [item.id, item.name]));
  const memberName = new Map(members.map((item) => [item.id, item.fullName]));

  const totalTasks = byStatus.reduce((sum, row) => sum + row._count._all, 0);
  const doneTasks = byStatus
    .filter((row) => CLOSED_TASK_STATUSES.includes(row.status as never))
    .reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Аналитика</h1>
          <p className="text-sm text-gray-500">Состояние на {formatDate(today)}</p>
        </div>
        <form className="flex items-end gap-2">
          <label className="field">
            Проект
            <select name="projectId" defaultValue={projectId} className="input w-64">
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Готовность задач"
          value={totalTasks === 0 ? "—" : `${Math.round((doneTasks / totalTasks) * 100)}%`}
          hint={`${doneTasks} из ${totalTasks}`}
        />
        <Metric
          label="Просрочено задач"
          value={String(overdueTasks)}
          tone={overdueTasks > 0 ? "danger" : "neutral"}
        />
        <Metric
          label="Просрочено писем"
          value={String(overdueLetters)}
          tone={overdueLetters > 0 ? "danger" : "neutral"}
        />
        <Metric label="Закрыто задач за 30 дней" value={String(closedLastMonth)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Задачи по статусам">
          <BarList
            rows={TASK_STATUSES.map((status) => ({
              label: TASK_STATUS_LABELS[status as TaskStatus],
              value: byStatus.find((row) => row.status === status)?._count._all ?? 0,
            })).filter((row) => row.value > 0)}
          />
        </Panel>

        <Panel title="Задачи по трекам">
          <BarList
            rows={byTrack
              .map((row) => ({ label: taskTrackLabel(row.track), value: row._count._all }))
              .sort((a, b) => b.value - a.value)}
          />
        </Panel>

        <Panel title="Открытые задачи по исполнителям">
          <BarList
            rows={byAssignee
              .map((row) => ({
                label: row.assigneeId
                  ? (memberName.get(row.assigneeId) ?? "—")
                  : "Без ответственного",
                value: row._count._all,
              }))
              .sort((a, b) => b.value - a.value)}
          />
        </Panel>

        <Panel title="Переписка по направлениям">
          <BarList
            rows={lettersByDirection.map((row) => ({
              label: letterDirectionLabel(row.direction),
              value: row._count._all,
            }))}
          />
        </Panel>

        <Panel title="Переписка по организациям">
          <BarList
            rows={lettersByCounterparty
              .map((row) => ({
                label: row.counterpartyId
                  ? (counterpartyName.get(row.counterpartyId) ?? "—")
                  : "Без организации",
                value: row._count._all,
              }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 10)}
          />
        </Panel>

        <Panel title="Документы по статусам">
          <BarList
            rows={documentsByStatus
              .map((row) => ({
                label: documentStatusLabel(row.status),
                value: row._count._all,
              }))
              .sort((a, b) => b.value - a.value)}
          />
        </Panel>
      </div>

      {declinedDocuments.length > 0 && (
        <Panel title="Отказы в подписании">
          <ul className="space-y-2 text-sm">
            {declinedDocuments.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/documents/${document.id}`}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {document.title}
                </Link>
                {document.counterparty && (
                  <span className="text-gray-500"> — {document.counterparty.name}</span>
                )}
                {document.statusNote && (
                  <p className="text-xs text-gray-500">{document.statusNote}</p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          tone === "danger" ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

/** Горизонтальные полосы: читаются без библиотеки графиков и печатаются как есть. */
function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">Нет данных.</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3">
          <span className="truncate text-sm text-gray-600" title={row.label}>
            {row.label}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-gray-100">
            <span
              className="block h-full rounded-full bg-gray-900"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </span>
          <span className="text-right text-sm tabular-nums text-gray-700">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
