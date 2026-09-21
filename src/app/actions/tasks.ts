"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { TASK_STATUSES, type TaskStatus } from "@/lib/domain";
import { type ActionResult, formatZodError, taskInputSchema } from "@/lib/validation";

export async function createTask(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = taskInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
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
  const parsed = taskInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  if (input.parentId === taskId) {
    return { ok: false, error: "Задача не может быть подзадачей самой себя" };
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
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/tasks");
}

export async function addComment(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const authorId = String(formData.get("authorId") ?? "") || null;
  if (!taskId || !body) return;

  await prisma.comment.create({ data: { taskId, body, authorId } });
  revalidatePath(`/tasks/${taskId}`);
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
