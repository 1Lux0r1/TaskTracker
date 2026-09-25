import Link from "next/link";
import { StatusBadge, VisibilityPill } from "@/components/badges";
import { DueTag, Prop, SectionCap, Who } from "@/components/ui";
import { notFound } from "next/navigation";
import { deleteTask, updateTask } from "@/app/actions/tasks";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachments";
import { AttachmentPanel } from "@/components/attachment-panel";
import { NoteFeed } from "@/components/note-feed";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { TaskForm } from "@/components/task-form";
import { prisma } from "@/lib/db";
import { formatFileSize } from "@/lib/attachments";
import {
  TASK_PRIORITY_LABELS,
  artifactKindLabel,
  formatDate,
  isLinkArtifact,
  isTaskOpen,
  type TaskPriority,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TaskPage(props: PageProps<"/tasks/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const editing = (await props.searchParams).edit === "1";

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: true,
      children: { include: { assignee: true }, orderBy: { number: "asc" } },
      artifacts: { orderBy: { sortOrder: "asc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      notes: { include: { author: true }, orderBy: { occurredOn: "desc" } },
      meeting: { select: { id: true, subject: true, date: true } },
      track: true,
      assignee: true,
      letter: { select: { id: true, number: true, subject: true, date: true } },
      parent: { select: { id: true, number: true, title: true } },
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

  const key = `${task.project.code}-${task.number}`;
  const open = isTaskOpen(task.status);
  const artifacts = task.artifacts;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <Link href={`/projects/${task.projectId}`} className="text-sm text-gray-500 hover:underline">
            ← {task.project.name} · {task.track.name}
          </Link>
          <h1 className="mt-1 text-[25px] leading-tight font-bold text-gray-900">
            <span className="font-mono text-[0.8em] font-medium text-gray-400">{key}</span> {task.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={deleteTask}>
            <input type="hidden" name="taskId" value={task.id} />
            <ConfirmSubmit
              className="btn-danger"
              question="Удалить задачу вместе с подзадачами и хроникой?"
            >
              Удалить
            </ConfirmSubmit>
          </form>
          {editing ? (
            <Link href={`/tasks/${task.id}`} className="btn-secondary">
              Готово
            </Link>
          ) : (
            <Link href={`/tasks/${task.id}?edit=1`} className="btn-primary">
              Редактировать
            </Link>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {editing ? (
            <TaskForm
              action={saveTask}
              projects={projects}
              members={members}
              tracks={tracks}
              parentCandidates={parentCandidates}
              letters={letters}
              documents={documents}
              canChangeVisibility={user.role === "ADMIN"}
              defaults={{
                ...task,
                artifacts: artifacts.map((artifact) => ({
                  kind: artifact.kind,
                  label: artifact.label ?? "",
                  value: artifact.value,
                })),
              }}
              submitLabel="Сохранить"
            />
          ) : (
            <section className="card space-y-5 p-[18px]">
              {/* Карточка открывается просмотром, как в макете: свойства
                  плитками, ниже разделы. Правка — по кнопке «Редактировать». */}
              <div className="grid grid-cols-2 gap-2.5">
                <Prop label="Статус">
                  <StatusBadge status={task.status} />
                </Prop>
                <Prop label="Ответственный">
                  <Who name={task.assignee?.fullName} />
                  {task.externalAssignee && (
                    <span className="mt-0.5 block text-xs text-gray-500">внешний: {task.externalAssignee}</span>
                  )}
                </Prop>
                <Prop label="Срок">
                  <DueTag date={task.dueDate} closed={!open} words />
                  {task.dueDate && (
                    <span className="ml-1.5 text-xs text-gray-500">{formatDate(task.dueDate)}</span>
                  )}
                </Prop>
                <Prop label="Приоритет">
                  <span
                    className={
                      task.priority === "HIGH" || task.priority === "CRITICAL"
                        ? "font-semibold text-red-600"
                        : ""
                    }
                  >
                    {TASK_PRIORITY_LABELS[task.priority as TaskPriority] ?? task.priority}
                  </span>
                </Prop>
                <Prop label="Готовность">
                  <span className="font-mono tabular-nums">{task.progress}%</span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                    />
                  </span>
                </Prop>
                <Prop label="Внешний трекер">
                  {task.externalTaskKey ? (
                    <span className="font-mono">{task.externalTaskKey}</span>
                  ) : (
                    <span className="text-gray-500">не связана</span>
                  )}
                </Prop>
                <Prop label="Видимость">
                  <VisibilityPill isPublic={task.isPublic} />
                </Prop>
                <Prop label="Сроки и трудозатраты">
                  <span className="text-[13px]">
                    {task.startDate ? `с ${formatDate(task.startDate)}` : "начало не указано"}
                    {(task.estimateHours !== null || task.spentHours !== null) && (
                      <span className="block text-xs text-gray-500">
                        оценка {task.estimateHours ?? "—"} ч · факт {task.spentHours ?? "—"} ч
                      </span>
                    )}
                    {task.completedAt && (
                      <span className="block text-xs text-green-600">закрыта {formatDate(task.completedAt)}</span>
                    )}
                  </span>
                </Prop>
              </div>

              {task.description && (
                <div>
                  <SectionCap>Описание</SectionCap>
                  <p className="text-sm whitespace-pre-line text-gray-900">{task.description}</p>
                </div>
              )}

              {task.progressNote && (
                <div>
                  <SectionCap>Ход работы</SectionCap>
                  <p className="text-sm whitespace-pre-line text-gray-900">{task.progressNote}</p>
                </div>
              )}

              <div>
                <SectionCap>Артефакты</SectionCap>
                {artifacts.length === 0 ? (
                  <p className="text-sm text-gray-500">Не добавлены</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {artifacts.map((artifact) => (
                      <li
                        key={artifact.id}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
                      >
                        <span className="text-xs text-gray-500">{artifactKindLabel(artifact.kind)}</span>
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
              </div>

              <div>
                <SectionCap>Связи</SectionCap>
                {!task.letter && !task.parent && !task.meeting ? (
                  <p className="text-sm text-gray-500">Нет</p>
                ) : (
                  <ul className="space-y-1 text-sm text-gray-900">
                    {task.letter && (
                      <li>
                        Письмо-основание:{" "}
                        <Link href={`/letters/${task.letter.id}`} className="text-brand hover:underline">
                          № {task.letter.number} от {formatDate(task.letter.date)} — {task.letter.subject}
                        </Link>
                      </li>
                    )}
                    {task.parent && (
                      <li>
                        Входит в задачу:{" "}
                        <Link href={`/tasks/${task.parent.id}`} className="text-brand hover:underline">
                          #{task.parent.number} {task.parent.title}
                        </Link>
                      </li>
                    )}
                    {/* Задача из протокола: видно, на какой встрече её решили завести. */}
                    {task.meeting && (
                      <li>
                        Из встречи:{" "}
                        <Link href={`/meetings/${task.meeting.id}`} className="text-brand hover:underline">
                          «{task.meeting.subject}» от {formatDate(task.meeting.date)}
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {task.children.length > 0 && (
                <div>
                  <SectionCap>Подзадачи</SectionCap>
                  <ul className="divide-y divide-gray-200">
                    {task.children.map((child) => (
                      <li key={child.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <Link href={`/tasks/${child.id}`} className="min-w-0 truncate text-gray-900 hover:underline">
                          #{child.number} {child.title}
                        </Link>
                        <span className="flex flex-none items-center gap-3">
                          <Who name={child.assignee?.fullName} />
                          <StatusBadge status={child.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
