import type { CurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readVisibility, type VisibilityEntity } from "@/lib/visibility";

/**
 * Правка видимости после создания записи. Участнику поле не показывают, но
 * форму можно и подделать, поэтому решает сервер: присланное значение
 * применяется только администратору. Каждая смена пишется в журнал.
 *
 * Возвращает то, что нужно дописать в data при обновлении записи: пустой
 * объект, если видимость не меняется.
 */
export async function applyVisibilityChange(
  user: CurrentUser,
  entity: VisibilityEntity,
  entityId: string,
  title: string,
  current: boolean,
  formData: FormData,
): Promise<{ isPublic?: boolean }> {
  const asked = readVisibility(formData);
  if (asked === null || asked === current) return {};
  if (user.role !== "ADMIN") return {};

  await prisma.visibilityChange.create({
    data: { entity, entityId, title, isPublic: asked, memberId: user.id },
  });
  return { isPublic: asked };
}
