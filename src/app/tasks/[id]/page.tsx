import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTask, updateTask } from "@/app/actions/tasks";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachments";
import { AttachmentPanel } from "@/components/attachment-panel";
import { NoteFeed } from "@/components/note-feed";
import { SubmitButton } from "@/components/submit-button";
import { TaskForm } from "@/components/task-form";
import { prisma } from "@/lib/db";
import { formatFileSize } from "@/lib/attachments";
import { artifactKindLabel, formatDate, isLinkArtifact, isOverdue } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TaskPage(props: PageProps<"/tasks/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: true,
      children: { include: { assignee: true }, orderBy: { number: "asc" } },
      artifacts: { orderBy: { sortOrder: "asc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      notes: { include: { author: true }, orderBy: { occurredOn: "desc" } },
      meeting: { select: { id: true, subject: true, date: true } },
    },
  });

  if (!task) notFound();

  const [projects, members, parentCandidates, letters, documents, tracks] = await Promise.all([
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
    prisma.document.findMany({
      where: { projectId: task.projectId },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 200,
    }),
    // Треки всех проектов: в форме можно сменить проект задачи. Архивный
    // трек показываем, если задача в нём уже лежит, иначе при сохранении он
    // молча сменился бы на первый из списка.
    prisma.track.findMany({
      where: { OR: [{ isArchived: false }, { id: task.trackId }] },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, projectId: true },
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
        {task.externalTaskKey && (
          <p className="mt-1 font-mono text-sm text-gray-500">
            Во внешнем трекере: {task.externalTaskKey}
          </p>
        )}
        {/* Задача из протокола: видно, на какой встрече её решили завести. */}
        {task.meeting && (
          <p className="mt-1 text-sm text-gray-500">
            Из встречи{" "}
            <Link href={`/meetings/${task.meeting.id}`} className="text-gray-700 hover:underline">
              «{task.meeting.subject}»
            </Link>{" "}
            от {formatDate(task.meeting.date)}
          </p>
        )}
        {task.artifacts.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {task.artifacts.map((artifact) => (
              <li
                key={artifact.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
              >
                <span className="text-xs text-gray-400">{artifactKindLabel(artifact.kind)}</span>
                {isLinkArtifact(artifact.kind) ? (
                  <a
                    href={artifact.value}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-900 hover:underline"
                  >
                    {artifact.label ?? artifact.value}
                  </a>
                ) : artifact.kind === "SYSTEM_DOC" ? (
                  <Link href={`/documents/${artifact.value}`} className="text-gray-900 hover:underline">
                    {artifact.label ?? "Документ системы"}
                  </Link>
                ) : (
                  <span className="text-gray-900">
                    {artifact.label ? `${artifact.label}: ${artifact.value}` : artifact.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

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
        tracks={tracks}
        parentCandidates={parentCandidates}
        letters={letters}
        documents={documents}
        defaults={{
          ...task,
          artifacts: task.artifacts.map((artifact) => ({
            kind: artifact.kind,
            label: artifact.label ?? "",
            value: artifact.value,
          })),
        }}
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

      <AttachmentPanel
        attachments={task.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          size: formatFileSize(attachment.size),
          uploadedBy: attachment.uploadedBy?.fullName ?? null,
          createdAt: formatDate(attachment.createdAt),
        }))}
        owner={{ field: "taskId", id: task.id }}
        upload={uploadAttachment}
        remove={deleteAttachment}
      />

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
