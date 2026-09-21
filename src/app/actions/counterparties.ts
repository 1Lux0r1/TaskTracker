"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  type ActionResult,
  counterpartyInputSchema,
  formatZodError,
} from "@/lib/validation";

export async function createCounterparty(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = counterpartyInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const duplicate = await prisma.counterparty.findUnique({ where: { name: parsed.data.name } });
  if (duplicate) return { ok: false, error: "Такой контрагент уже есть" };

  await prisma.counterparty.create({ data: parsed.data });
  revalidatePath("/counterparties");
  return { ok: true, message: "Контрагент добавлен" };
}

export async function updateCounterparty(
  counterpartyId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = counterpartyInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const duplicate = await prisma.counterparty.findUnique({ where: { name: parsed.data.name } });
  if (duplicate && duplicate.id !== counterpartyId) {
    return { ok: false, error: "Контрагент с таким названием уже есть" };
  }

  await prisma.counterparty.update({ where: { id: counterpartyId }, data: parsed.data });
  revalidatePath("/counterparties");
  return { ok: true, message: "Сохранено" };
}

/**
 * Контрагента не удаляем, если на него ссылаются письма или документы:
 * история переписки важнее чистоты справочника.
 */
export async function deleteCounterparty(formData: FormData): Promise<void> {
  const counterpartyId = String(formData.get("counterpartyId") ?? "");
  if (!counterpartyId) return;

  const usage = await prisma.counterparty.findUnique({
    where: { id: counterpartyId },
    include: { _count: { select: { letters: true, documents: true } } },
  });
  if (!usage) return;

  if (usage._count.letters > 0 || usage._count.documents > 0) {
    await prisma.counterparty.update({ where: { id: counterpartyId }, data: { isActive: false } });
  } else {
    await prisma.counterparty.delete({ where: { id: counterpartyId } });
  }
  revalidatePath("/counterparties");
}

/**
 * Отметка «наша организация». Нужна матрице подписания: сторона без отметки
 * считается внешней, даже если это соседний департамент, — иначе выборка
 * «ждут нашей подписи» показывает чужие подписи как свои.
 */
export async function toggleInternalCounterparty(formData: FormData): Promise<void> {
  const counterpartyId = String(formData.get("counterpartyId") ?? "");
  if (!counterpartyId) return;

  const current = await prisma.counterparty.findUnique({
    where: { id: counterpartyId },
    select: { isInternal: true },
  });
  if (!current) return;

  await prisma.counterparty.update({
    where: { id: counterpartyId },
    data: { isInternal: !current.isInternal },
  });
  revalidatePath("/counterparties");
  revalidatePath("/documents");
}

export async function restoreCounterparty(formData: FormData): Promise<void> {
  const counterpartyId = String(formData.get("counterpartyId") ?? "");
  if (!counterpartyId) return;

  await prisma.counterparty.update({ where: { id: counterpartyId }, data: { isActive: true } });
  revalidatePath("/counterparties");
}
