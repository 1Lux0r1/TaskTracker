"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { VISIBILITY_ENTITIES, type VisibilityEntity } from "@/lib/visibility";

/**
 * Видимость сразу нескольким записям: полсотни загруженных писем иначе
 * пришлось бы открывать по одному. Менять видимость после создания может
 * только администратор, и каждая запись попадает в журнал отдельной строкой.
 */
export async function setVisibilityForMany(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;

  const entity = String(formData.get("entity") ?? "") as VisibilityEntity;
  if (!VISIBILITY_ENTITIES.some((item) => item.value === entity)) return;

  const isPublic = String(formData.get("visibility") ?? "") === "PUBLIC";
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;

  if (entity === "TASK") {
    const rows = await prisma.task.findMany({
      where: { id: { in: ids }, isPublic: !isPublic },
      select: { id: true, title: true },
    });
    await apply(rows, "TASK", isPublic, user.id, (ids) =>
      prisma.task.updateMany({ where: { id: { in: ids } }, data: { isPublic } }),
    );
    revalidatePath("/tasks");
  }

  if (entity === "LETTER") {
    const rows = await prisma.letter.findMany({
      where: { id: { in: ids }, isPublic: !isPublic },
      select: { id: true, number: true, subject: true },
    });
    await apply(
      rows.map((row) => ({ id: row.id, title: `№ ${row.number} — ${row.subject}` })),
      "LETTER",
      isPublic,
      user.id,
      (ids) => prisma.letter.updateMany({ where: { id: { in: ids } }, data: { isPublic } }),
    );
    revalidatePath("/letters");
  }

  if (entity === "DOCUMENT") {
    const rows = await prisma.document.findMany({
      where: { id: { in: ids }, isPublic: !isPublic },
      select: { id: true, title: true },
    });
    await apply(rows, "DOCUMENT", isPublic, user.id, (ids) =>
      prisma.document.updateMany({ where: { id: { in: ids } }, data: { isPublic } }),
    );
    revalidatePath("/documents");
  }

  revalidatePath("/visibility-log");
}

/**
 * Записи, у которых видимость уже нужная, не трогаем: иначе журнал заполнят
 * строки о смене, которой не было.
 */
async function apply(
  rows: { id: string; title: string }[],
  entity: VisibilityEntity,
  isPublic: boolean,
  memberId: string,
  update: (ids: string[]) => Promise<unknown>,
): Promise<void> {
  if (rows.length === 0) return;

  await update(rows.map((row) => row.id));
  await prisma.visibilityChange.createMany({
    data: rows.map((row) => ({
      entity,
      entityId: row.id,
      title: row.title,
      isPublic,
      memberId,
    })),
  });
}
