import Link from "next/link";
import { createTask } from "@/app/actions/tasks";
import { TaskForm } from "@/components/task-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewTaskPage(props: PageProps<"/tasks/new">) {
  const params = await props.searchParams;
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  const [projects, members] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  if (projects.length === 0) {
    return (
      <p className="card p-6 text-sm text-gray-500">
        Сначала создайте проект:{" "}
        <Link href="/projects/new" className="font-medium text-gray-900 hover:underline">
          новый проект
        </Link>
        .
      </p>
    );
  }

  const selected = projectId && projects.some((p) => p.id === projectId) ? projectId : projects[0].id;
  const [parentCandidates, letters] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: selected, parentId: null },
      orderBy: { number: "asc" },
      select: { id: true, number: true, title: true },
      take: 200,
    }),
    prisma.letter.findMany({
      where: { projectId: selected },
      orderBy: { date: "desc" },
      select: { id: true, number: true, subject: true },
      take: 200,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href={`/projects/${selected}`} className="text-sm text-gray-500 hover:underline">
          ← К проекту
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новая задача</h1>
      </div>
      <TaskForm
        action={createTask}
        projects={projects}
        members={members}
        parentCandidates={parentCandidates}
        letters={letters}
        defaults={{
          projectId: selected,
          title: "",
          description: null,
          status: "TODO",
          priority: "MEDIUM",
          assigneeId: null,
          externalAssignee: null,
          track: "PRODUCTION",
          progressNote: null,
          resultLink: null,
          letterId: null,
          parentId: null,
          startDate: null,
          dueDate: null,
          estimateHours: null,
          spentHours: null,
          progress: 0,
        }}
        submitLabel="Создать задачу"
      />
    </div>
  );
}
