"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  authenticate,
  createSession,
  destroySession,
  purgeExpiredSessions,
  requireAdmin,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkPasswordRules, hashPassword, verifyPassword } from "@/lib/password";
import type { ActionResult } from "@/lib/validation";

export async function login(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Введите почту и пароль" };
  }

  const member = await authenticate(email, password);
  if (!member) {
    return { ok: false, error: "Не подходит почта или пароль" };
  }

  await purgeExpiredSessions();
  const userAgent = (await headers()).get("user-agent");
  await createSession(member.id, userAgent);
  await prisma.member.update({
    where: { id: member.id },
    data: { lastLoginAt: new Date() },
  });

  const target = String(formData.get("next") ?? "/");
  // Открываем только свои страницы: внешний адрес в поле next увёл бы
  // пользователя с сайта сразу после входа.
  redirect(target.startsWith("/") && !target.startsWith("//") ? target : "/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Смена собственного пароля: нужен текущий. */
export async function changeOwnPassword(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");

  const member = await prisma.member.findUnique({ where: { id: user.id } });
  if (!member || !(await verifyPassword(current, member.passwordHash))) {
    return { ok: false, error: "Текущий пароль не подошёл" };
  }
  const problem = checkPasswordRules(next);
  if (problem) return { ok: false, error: problem };

  await prisma.member.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  // Остальные входы этого человека гасим: пароль сменили не просто так.
  await prisma.session.deleteMany({ where: { memberId: user.id } });
  return { ok: true, message: "Пароль изменён, войдите заново на других устройствах" };
}

/** Администратор заводит или меняет пароль сотруднику. */
export async function setMemberPassword(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  const password = String(formData.get("password") ?? "");

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { ok: false, error: "Сотрудник не найден" };
  if (!member.email) {
    return { ok: false, error: "Сначала впишите сотруднику почту: по ней он входит" };
  }
  const problem = checkPasswordRules(password);
  if (problem) return { ok: false, error: problem };

  await prisma.member.update({
    where: { id: memberId },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.session.deleteMany({ where: { memberId } });
  revalidatePath("/members");
  return { ok: true, message: `Пароль задан: ${member.fullName}` };
}

/** Администратор переключает роль. Себя последним администратором не оставляем без прав. */
export async function toggleMemberRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;

  const nextRole = member.role === "ADMIN" ? "MEMBER" : "ADMIN";
  if (nextRole === "MEMBER") {
    const admins = await prisma.member.count({ where: { role: "ADMIN", isActive: true } });
    if (admins <= 1) return;
    if (member.id === admin.id) return;
  }

  await prisma.member.update({ where: { id: memberId }, data: { role: nextRole } });
  revalidatePath("/members");
}

/** Администратор закрывает сотруднику вход, не трогая его задачи. */
export async function revokeMemberAccess(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId || memberId === admin.id) return;

  await prisma.member.update({ where: { id: memberId }, data: { passwordHash: null } });
  await prisma.session.deleteMany({ where: { memberId } });
  revalidatePath("/members");
}
