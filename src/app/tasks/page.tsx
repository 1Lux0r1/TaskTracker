import Link from "next/link";
import { TaskTable } from "@/components/task-table";
import { prisma } from "@/lib/db";
import {
  CLOSED_TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  startOfToday,
  type TaskStatus,
} from "@/lib/domain";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/** Пресеты вместо длинной формы фильтров: закрывают 90 % повседневных выборок. */
const PRESETS = [
  { value: "open", label: "Открытые" },
  { value: "overdue", label: "Просроченные" },
  { value: "unassigned", label: "Без ответственного" },
  { value: "all", label: "Все" },
] as const;

export default async function TasksPage(props: PageProps<"/tasks">) {
  const params = await props.searchParams;
  const preset = single(params.preset) ?? "open";
  const projectId = single(params.projectId) ?? "";
  const assigneeId = single(params.assigneeId) ?? "";
  const status = single(params.status) ?? "";

  const where: Prisma.TaskWhereInput = {};
  if (preset === "open") where.status = { notIn: CLOSED_TASK_STATUSES };
  if (preset === "overdue") {
    where.status = { notIn: CLOSED_TASK_STATUSES };
    where.dueDate = { lt: startOfToday() };
  }
  if (preset === "unassigned") {
    where.status = { notIn: CLOSED_TASK_STATUSES };
    where.assigneeId = null;
  }
  if (projectId) where.projectId = projectId;
  if (assigneeId) where.assigneeId = assigneeId;
  if (status && TASK_STATUSES.includes(status as TaskStatus)) where.status = status;

  const [tasks, projects, members] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignee: true, project: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.project.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Задачи</h1>
        <div className="flex gap-2">
          <Link href="/api/export" className="btn-secondary">
            Выгрузить в Excel
          </Link>
          <Link href="/tasks/new" className="btn-primary">
            Новая задача
          </Link>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="field">
          Выборка
          <select name="preset" defaultValue={preset} className="input w-48">
            {PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
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
        <label className="field">
          Ответственный
          <select name="assigneeId" defaultValue={assigneeId} className="input w-56">
            <option value="">Все</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Статус
          <select name="status" defaultValue={status} className="input w-48">
            <option value="">Любой</option>
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TASK_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary">
          Показать
        </button>
      </form>

      <p className="text-sm text-gray-500">Найдено задач: {tasks.length}</p>
      <TaskTable tasks={tasks} showProject emptyMessage="Под фильтр ничего не подошло." />
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
