"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { type ActionResult, formatZodError, trackInputSchema } from "@/lib/validation";

/** Новый трек проекта. Порядок — в конец списка. */
export async function createTrack(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = trackInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const duplicate = await prisma.track.findFirst({
    where: { projectId: parsed.data.projectId, name: parsed.data.name },
  });
  if (duplicate) return { ok: false, error: "Трек с таким названием в проекте уже есть" };

  const last = await prisma.track.findFirst({
    where: { projectId: parsed.data.projectId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.track.create({
    data: { ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/tracks");
  return { ok: true, message: "Трек добавлен" };
}

/** Переименование и смена цвета. */
export async function updateTrack(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const id = String(formData.get("trackId") ?? "");
  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) return { ok: false, error: "Трек не найден" };

  const parsed = trackInputSchema.safeParse({
    projectId: track.projectId,
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const duplicate = await prisma.track.findFirst({
    where: { projectId: track.projectId, name: parsed.data.name, id: { not: id } },
  });
  if (duplicate) return { ok: false, error: "Трек с таким названием в проекте уже есть" };

  await prisma.track.update({
    where: { id },
    data: { name: parsed.data.name, color: parsed.data.color },
  });
  revalidatePath("/tracks");
  return { ok: true, message: "Трек изменён" };
}

/** Архив вместо удаления: из выбора трек исчезает, задачи остаются. */
export async function toggleTrackArchived(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("trackId") ?? "");
  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) return;

  await prisma.track.update({ where: { id }, data: { isArchived: !track.isArchived } });
  revalidatePath("/tracks");
}

/** Порядок в списке: трек двигается на одну позицию. */
export async function moveTrack(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("trackId") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";

  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) return;

  const neighbour = await prisma.track.findFirst({
    where: {
      projectId: track.projectId,
      sortOrder: direction === "up" ? { lt: track.sortOrder } : { gt: track.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;

  await prisma.$transaction([
    prisma.track.update({ where: { id: track.id }, data: { sortOrder: neighbour.sortOrder } }),
    prisma.track.update({ where: { id: neighbour.id }, data: { sortOrder: track.sortOrder } }),
  ]);
  revalidatePath("/tracks");
}

/** Удалить можно только пустой трек: иначе задачи остались бы без трека. */
export async function deleteTrack(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("trackId") ?? "");
  const tasks = await prisma.task.count({ where: { trackId: id } });
  if (tasks > 0) return;

  await prisma.track.delete({ where: { id } });
  revalidatePath("/tracks");
}
