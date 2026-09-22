"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { TASK_STATUSES, type TaskStatus } from "@/lib/domain";
import { type ActionResult, formatZodError, taskInputSchema } from "@/lib/validation";

/**
 * Трек принадлежит проекту: в форме проект можно сменить, и трек прошлого
 * проекта не должен уехать в новый — в его справочнике такого трека нет.
 */
async function trackBelongsToProject(trackId: string, projectId: string): Promise<boolean> {
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { projectId: true },
  });
  return track?.projectId === projectId;
}

export async function createTask(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = taskInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  if (!(await trackBelongsToProject(input.trackId, input.projectId))) {
    return { ok: false, error: "Выбранный трек относится к другому проекту" };
  }

  const last = await prisma.task.findFirst({
    where: { projectId: input.projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = (last?.number ?? 0) + 1;

  await prisma.task.create({
    data: {
      ...input,
      number,
      sortOrder: number,
      completedAt: input.status === "DONE" ? new Date() : null,
    },
  });

  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/tasks");
  return { ok: true, message: "Задача создана" };
}

export async function updateTask(
  taskId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = taskInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  if (input.parentId === taskId) {
    return { ok: false, error: "Задача не может быть подзадачей самой себя" };
  }
  if (!(await trackBelongsToProject(input.trackId, input.projectId))) {
    return { ok: false, error: "Выбранный трек относится к другому проекту" };
  }

  const current = await prisma.task.findUnique({ where: { id: taskId } });
  if (!current) return { ok: false, error: "Задача не найдена" };

  await prisma.task.update({
    where: { id: taskId },
    data: {
      ...input,
      completedAt: completedAtFor(input.status, current.status, current.completedAt),
    },
  });

  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  return { ok: true, message: "Задача сохранена" };
}

/** Смена статуса с канбан-доски и из таблицы — одним запросом, без формы. */
export async function changeTaskStatus(formData: FormData): Promise<void> {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!taskId || !TASK_STATUSES.includes(status as TaskStatus)) return;

  const current = await prisma.task.findUnique({ where: { id: taskId } });
  if (!current) return;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      progress: status === "DONE" ? 100 : current.progress,
      completedAt: completedAtFor(status, current.status, current.completedAt),
    },
  });

  revalidatePath(`/projects/${current.projectId}`);
  revalidatePath("/tasks");
}

export async function deleteTask(formData: FormData): Promise<void> {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/tasks");
}

/**
 * Запись в ленту хроники. Дата события задаётся отдельно от даты внесения:
 * в исходных таблицах пишут «05.05.2026 драфт загружен в ЭДО» задним числом.
 */
export async function addNote(formData: FormData): Promise<void> {
  await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const taskId = String(formData.get("taskId") ?? "") || null;
  const letterId = String(formData.get("letterId") ?? "") || null;
  const documentId = String(formData.get("documentId") ?? "") || null;
  if (!taskId && !letterId && !documentId) return;

  const rawDate = String(formData.get("occurredOn") ?? "").trim();
  const occurredOn = rawDate ? new Date(`${rawDate}T00:00:00`) : new Date();

  await prisma.note.create({
    data: {
      body,
      occurredOn: Number.isNaN(occurredOn.getTime()) ? new Date() : occurredOn,
      authorId: String(formData.get("authorId") ?? "") || null,
      taskId,
      letterId,
      documentId,
    },
  });

  if (taskId) revalidatePath(`/tasks/${taskId}`);
  if (letterId) revalidatePath(`/letters/${letterId}`);
  if (documentId) revalidatePath(`/documents/${documentId}`);
}

export async function deleteNote(formData: FormData): Promise<void> {
  await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  if (!noteId) return;

  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) return;

  await prisma.note.delete({ where: { id: noteId } });
  if (note.taskId) revalidatePath(`/tasks/${note.taskId}`);
  if (note.letterId) revalidatePath(`/letters/${note.letterId}`);
  if (note.documentId) revalidatePath(`/documents/${note.documentId}`);
}

/** Дата закрытия ставится при переходе в «Готово» и снимается при возврате в работу. */
function completedAtFor(
  nextStatus: string,
  previousStatus: string,
  previousCompletedAt: Date | null,
): Date | null {
  if (nextStatus !== "DONE") return null;
  return previousStatus === "DONE" ? previousCompletedAt : new Date();
}
