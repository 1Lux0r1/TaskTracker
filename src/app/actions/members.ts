"use server";

import { requireAdmin, requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { type ActionResult, formatZodError, memberInputSchema } from "@/lib/validation";

/** Сотрудников ведёт администратор: карточка — это и будущая учётная запись. */
export async function createMember(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = memberInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  if (parsed.data.email) {
    const duplicate = await prisma.member.findUnique({ where: { email: parsed.data.email } });
    if (duplicate) return { ok: false, error: "Сотрудник с таким email уже есть" };
  }

  await prisma.member.create({ data: parsed.data });
  revalidatePath("/members");
  return { ok: true, message: "Сотрудник добавлен" };
}

/**
 * Правка карточки: у сотрудников из импорта почты обычно нет, а без неё
 * человеку не выдать доступ — вход идёт по почте.
 */
export async function updateMember(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { ok: false, error: "Сотрудник не найден" };

  const parsed = memberInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  if (parsed.data.email) {
    const duplicate = await prisma.member.findFirst({
      where: { email: parsed.data.email, id: { not: memberId } },
    });
    if (duplicate) return { ok: false, error: "Сотрудник с таким email уже есть" };
  }
  // Пароль привязан к почте: сменили почту — старые входы гасим.
  const emailChanged = parsed.data.email !== member.email;

  await prisma.member.update({ where: { id: memberId }, data: parsed.data });
  if (emailChanged) {
    await prisma.session.deleteMany({ where: { memberId } });
  }
  revalidatePath("/members");
  return { ok: true, message: "Карточка изменена" };
}

/**
 * Сотрудников не удаляем: на них ссылаются закрытые задачи и история проектов.
 * Вместо этого снимаем флаг активности — из списков выбора он исчезает.
 *
 * Архив закрывает и вход, поэтому право на кнопку есть только у администратора,
 * себя отправить в архив нельзя, и последний активный администратор остаётся:
 * иначе некому будет вернуть доступ.
 */
export async function toggleMemberActive(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;

  const goingToArchive = member.isActive;
  if (goingToArchive) {
    if (member.id === admin.id) return;
    if (member.role === "ADMIN") {
      const admins = await prisma.member.count({ where: { role: "ADMIN", isActive: true } });
      if (admins <= 1) return;
    }
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { isActive: !member.isActive },
  });
  // В архиве человек войти не может, поэтому и открытые сессии ему не нужны.
  if (goingToArchive) {
    await prisma.session.deleteMany({ where: { memberId } });
  }
  revalidatePath("/members");
}

/**
 * Имя для обращения человек задаёт себе сам: администратор для этого не нужен,
 * а в ФИО из импорта имя не всегда стоит там, где его ждёт приветствие.
 */
export async function updateOwnDisplayName(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const value = String(formData.get("displayName") ?? "").trim();
  if (value.length > 60) return { ok: false, error: "Имя длиннее 60 символов" };

  await prisma.member.update({
    where: { id: user.id },
    data: { displayName: value.length === 0 ? null : value },
  });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true, message: value ? "Имя сохранено" : "Имя будет браться из ФИО" };
}
