import Link from "next/link";
import { ProjectStatusBadge } from "@/components/badges";
import { prisma } from "@/lib/db";
import { CLOSED_TASK_STATUSES, formatDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      _count: { select: { tasks: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Проекты</h1>
        <Link href="/projects/new" className="btn-primary">
          Новый проект
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Проектов пока нет.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-head w-24">Код</th>
                <th className="table-head">Название</th>
                <th className="table-head w-36">Статус</th>
                <th className="table-head w-44">Руководитель</th>
                <th className="table-head w-28">Срок</th>
                <th className="table-head w-32">Задачи</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((project) => {
                const done = project.tasks.filter((task) =>
                  CLOSED_TASK_STATUSES.includes(task.status as never),
                ).length;
                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-gray-500">{project.code}</td>
                    <td className="table-cell">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="table-cell">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="table-cell">{project.owner?.fullName ?? "—"}</td>
                    <td className="table-cell tabular-nums">{formatDate(project.dueDate)}</td>
                    <td className="table-cell tabular-nums">
                      {done} из {project._count.tasks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
