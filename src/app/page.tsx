import Link from "next/link";
import { ProjectStatusBadge } from "@/components/badges";
import { TaskTable } from "@/components/task-table";
import { prisma } from "@/lib/db";
import { CLOSED_TASK_STATUSES, formatDate, startOfToday } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = startOfToday();
  const weekAhead = new Date(today.getTime() + 7 * 86_400_000);
  const openStatuses = { notIn: CLOSED_TASK_STATUSES };

  const [projects, openTasks, overdue, dueThisWeek, unassigned, soonTasks] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      include: { _count: { select: { tasks: true } }, owner: true },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.task.count({ where: { status: openStatuses } }),
    prisma.task.count({ where: { status: openStatuses, dueDate: { lt: today } } }),
    prisma.task.count({
      where: { status: openStatuses, dueDate: { gte: today, lte: weekAhead } },
    }),
    prisma.task.count({ where: { status: openStatuses, assigneeId: null } }),
    prisma.task.findMany({
      where: { status: openStatuses, dueDate: { not: null, lte: weekAhead } },
      include: { assignee: true, project: true },
      orderBy: { dueDate: "asc" },
      take: 15,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Сводка</h1>
          <p className="text-sm text-gray-500">Состояние проектов на {formatDate(today)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/tasks/new" className="btn-primary">
            Новая задача
          </Link>
          <Link href="/projects/new" className="btn-secondary">
            Новый проект
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Открытых задач" value={openTasks} />
        <MetricCard label="Просрочено" value={overdue} tone={overdue > 0 ? "danger" : "neutral"} />
        <MetricCard label="Срок в ближайшую неделю" value={dueThisWeek} />
        <MetricCard label="Без ответственного" value={unassigned} tone={unassigned > 0 ? "warning" : "neutral"} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Проекты</h2>
        {projects.length === 0 ? (
          <p className="card p-6 text-sm text-gray-500">
            Проектов пока нет.{" "}
            <Link href="/projects/new" className="font-medium text-gray-900 hover:underline">
              Создайте первый
            </Link>{" "}
            или{" "}
            <Link href="/import" className="font-medium text-gray-900 hover:underline">
              загрузите задачи из Excel
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="card p-4 hover:border-gray-400">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-400">{project.code}</p>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <dl className="mt-3 space-y-1 text-sm text-gray-500">
                  <div className="flex justify-between">
                    <dt>Задач</dt>
                    <dd className="tabular-nums">{project._count.tasks}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Срок</dt>
                    <dd className="tabular-nums">{formatDate(project.dueDate)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Руководитель</dt>
                    <dd>{project.owner?.fullName ?? "—"}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Ближайшие и просроченные сроки</h2>
        <TaskTable
          tasks={soonTasks}
          showProject
          emptyMessage="В ближайшую неделю сроков нет."
        />
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "danger";
}) {
  const valueClass =
    tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="card p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
