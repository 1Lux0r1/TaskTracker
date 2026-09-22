import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectStatusBadge } from "@/components/badges";
import { TaskTable } from "@/components/task-table";
import { prisma } from "@/lib/db";
import { CLOSED_TASK_STATUSES, formatDate, isOverdue, projectStatusLabel } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: true,
      tasks: {
        include: { assignee: true, track: true },
        orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
      },
    },
  });

  if (!project) notFound();

  const total = project.tasks.length;
  const closed = project.tasks.filter((task) =>
    CLOSED_TASK_STATUSES.includes(task.status as never),
  ).length;
  const overdue = project.tasks.filter((task) => isOverdue(task.dueDate, task.status)).length;
  const estimate = sum(project.tasks.map((task) => task.estimateHours));
  const spent = sum(project.tasks.map((task) => task.spentHours));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/projects" className="text-sm text-gray-500 hover:underline">
            ← Проекты
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
            <span className="text-sm font-medium text-gray-400">{project.code}</span>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="mt-2 max-w-3xl text-sm text-gray-600">{project.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${project.id}/board`} className="btn-secondary">
            Канбан-доска
          </Link>
          <Link href={`/api/export?projectId=${project.id}`} className="btn-secondary">
            Выгрузить в Excel
          </Link>
          <Link href={`/projects/${project.id}/edit`} className="btn-secondary">
            Настройки
          </Link>
          <Link href={`/tasks/new?projectId=${project.id}`} className="btn-primary">
            Новая задача
          </Link>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Fact label="Статус" value={projectStatusLabel(project.status)} />
        <Fact label="Руководитель" value={project.owner?.fullName ?? "—"} />
        <Fact label="Сроки" value={`${formatDate(project.startDate)} — ${formatDate(project.dueDate)}`} />
        <Fact label="Готово задач" value={`${closed} из ${total}`} />
        <Fact
          label="Часы (факт / план)"
          value={`${formatHours(spent)} / ${formatHours(estimate)}`}
        />
      </dl>

      {overdue > 0 && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Просрочено задач: {overdue}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Задачи</h2>
        <TaskTable
          tasks={project.tasks.map((task) => ({ ...task, project: null }))}
          emptyMessage="В проекте пока нет задач. Добавьте вручную или загрузите из Excel."
        />
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function sum(values: (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function formatHours(value: number): string {
  return value === 0 ? "—" : `${Math.round(value * 10) / 10} ч`;
}
