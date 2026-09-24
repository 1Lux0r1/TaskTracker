"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  type ActionResult,
  formatZodError,
  orgContactInputSchema,
} from "@/lib/validation";

/**
 * Ответственные представители организаций. Это не пользователи системы:
 * записи нужны, чтобы отмечать участников встреч и знать, к кому обращаться
 * по конкретному вопросу.
 */
export async function createOrgContact(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = orgContactInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  await prisma.orgContact.create({ data: parsed.data });
  revalidatePath("/org-contacts");
  return { ok: true, message: "Представитель добавлен" };
}

export async function updateOrgContact(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) return { ok: false, error: "Не понятно, кого править" };

  const parsed = orgContactInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  await prisma.orgContact.update({ where: { id: contactId }, data: parsed.data });
  revalidatePath("/org-contacts");
  revalidatePath("/meetings");
  return { ok: true, message: "Сохранено" };
}

/**
 * Представитель уходит в архив, а не удаляется: он отмечен участником
 * прошедших встреч, и протокол должен остаться целым.
 */
export async function toggleOrgContactActive(formData: FormData): Promise<void> {
  await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) return;

  const contact = await prisma.orgContact.findUnique({ where: { id: contactId } });
  if (!contact) return;

  await prisma.orgContact.update({
    where: { id: contactId },
    data: { isActive: !contact.isActive },
  });
  revalidatePath("/org-contacts");
  revalidatePath("/meetings");
}
