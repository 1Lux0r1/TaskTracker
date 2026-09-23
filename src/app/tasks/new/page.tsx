import Link from "next/link";
import { createTask } from "@/app/actions/tasks";
import { TaskForm } from "@/components/task-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { VISIBILITY_DEFAULTS } from "@/lib/visibility";
import { NEW_TASK_STATUS } from "@/lib/domain";
import { ensureProjectTracks } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export default async function NewTaskPage(props: PageProps<"/tasks/new">) {
  await requireUser();
  const params = await props.searchParams;
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  // Дата приходит из панели дня в календаре: «завести задачу на этот день».
  const dueDate = parseDay(Array.isArray(params.dueDate) ? params.dueDate[0] : params.dueDate);

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
  await ensureProjectTracks(selected);
  const [parentCandidates, letters, documents, tracks] = await Promise.all([
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
    // Треки всех проектов: в форме можно сменить проект, и список треков
    // должен смениться вместе с ним.
    prisma.document.findMany({
      where: { projectId: selected },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 200,
    }),
    prisma.track.findMany({
      where: { isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, projectId: true },
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
        tracks={tracks}
        parentCandidates={parentCandidates}
        letters={letters}
        documents={documents}
        hideStatus
        isNew
        defaults={{
          projectId: selected,
          title: "",
          description: null,
          status: NEW_TASK_STATUS,
          priority: "MEDIUM",
          assigneeId: null,
          externalAssignee: null,
          externalTaskKey: null,
          trackId: tracks.find((track) => track.projectId === selected)?.id ?? "",
          progressNote: null,
          artifacts: [],
          isPublic: VISIBILITY_DEFAULTS.TASK,
          letterId: null,
          parentId: null,
          startDate: null,
          dueDate,
          estimateHours: null,
          spentHours: null,
          progress: 0,
        }}
        submitLabel="Создать задачу"
      />
    </div>
  );
}

function parseDay(value: string | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
