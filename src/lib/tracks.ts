import { prisma } from "@/lib/db";
import { BASE_TRACKS } from "@/lib/domain";

/**
 * Заводит проекту базовые треки, если их ещё нет. Вызывается при создании
 * проекта и при импорте: справочник не должен оказаться пустым, иначе
 * задачу некуда положить.
 */
export async function ensureProjectTracks(projectId: string): Promise<void> {
  const existing = await prisma.track.count({ where: { projectId } });
  if (existing > 0) return;

  await prisma.track.createMany({
    data: BASE_TRACKS.map((track) => ({ projectId, ...track })),
  });
}

/**
 * Трек проекта по коду из импорта. Если трека с таким кодом нет (переименован
 * или удалён), берём первый неархивный — задача не должна потеряться.
 */
export async function resolveTrackId(projectId: string, key: string): Promise<string> {
  await ensureProjectTracks(projectId);

  const byKey = await prisma.track.findFirst({ where: { projectId, key } });
  if (byKey) return byKey.id;

  const fallback = await prisma.track.findFirst({
    where: { projectId, isArchived: false },
    orderBy: { sortOrder: "asc" },
  });
  if (fallback) return fallback.id;

  const created = await prisma.track.create({
    data: { projectId, key: "PRODUCTION", name: "Производственный", color: "blue", sortOrder: 0 },
  });
  return created.id;
}
