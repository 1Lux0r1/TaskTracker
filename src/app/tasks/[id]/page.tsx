import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTask, updateTask } from "@/app/actions/tasks";
import { NoteFeed } from "@/components/note-feed";
import { SubmitButton } from "@/components/submit-button";
import { TaskForm } from "@/components/task-form";
import { prisma } from "@/lib/db";
import { formatDate, isOverdue } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function TaskPage(props: PageProps<"/tasks/[id]">) {
  const { id } = await props.params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: true,
      children: { include: { assignee: true }, orderBy: { number: "asc" } },
      notes: { include: { author: true }, orderBy: { occurredOn: "desc" } },
    },
  });

  if (!task) notFound();

  const [projects, members, parentCandidates, letters] = await Promise.all([
    prisma.project.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.task.findMany({
      where: { projectId: task.projectId, parentId: null, id: { not: id } },
      orderBy: { number: "asc" },
      select: { id: true, number: true, title: true },
      take: 200,
    }),
    prisma.letter.findMany({
      where: { projectId: task.projectId },
      orderBy: { date: "desc" },
      select: { id: true, number: true, subject: true },
      take: 200,
    }),
  ]);

  const saveTask = updateTask.bind(null, task.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={`/projects/${task.projectId}`} className="text-sm text-gray-500 hover:underline">
          ← {task.project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          <span className="text-gray-400">{task.project.code}-{task.number}</span> {task.title}
        </h1>
        {isOverdue(task.dueDate, task.status) && (
          <p className="mt-2 text-sm font-medium text-red-600">
            Просрочена: срок был {formatDate(task.dueDate)}
          </p>
        )}
        {task.completedAt && (
          <p className="mt-2 text-sm text-emerald-700">Закрыта {formatDate(task.completedAt)}</p>
        )}
      </div>

      <TaskForm
        action={saveTask}
        projects={projects}
        members={members}
        parentCandidates={parentCandidates}
        letters={letters}
        defaults={task}
        submitLabel="Сохранить"
      />

      {task.children.length > 0 && (
        <section className="card space-y-2 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Подзадачи</h2>
          <ul className="divide-y divide-gray-100">
            {task.children.map((child) => (
              <li key={child.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/tasks/${child.id}`} className="text-gray-900 hover:underline">
                  #{child.number} {child.title}
                </Link>
                <span className="text-gray-500">{child.assignee?.fullName ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NoteFeed notes={task.notes} members={members} taskId={task.id} />

      <form action={deleteTask} className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Удалить задачу</h2>
        <p className="text-sm text-gray-500">
          Подзадачи и комментарии удалятся вместе с ней. Действие необратимо.
        </p>
        <input type="hidden" name="taskId" value={task.id} />
        <SubmitButton className="btn-danger" pendingLabel="Удаляем…">
          Удалить задачу
        </SubmitButton>
      </form>
    </div>
  );
}
