import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

/** Имя cookie с токеном сессии. Проверяется ещё и в proxy.ts. */
export const SESSION_COOKIE = "tt_session";

const SESSION_DAYS = 14;

export type Role = "ADMIN" | "MEMBER";

export type CurrentUser = {
  id: string;
  fullName: string;
  /** Имя для обращения; пусто — берётся из ФИО. */
  displayName: string | null;
  email: string | null;
  position: string | null;
  role: Role;
};

/**
 * Флаг Secure у cookie входа. В продакшене он включён, и тогда вход работает
 * только по HTTPS. Установка во внутренней сети по обычному http возможна:
 * SESSION_COOKIE_SECURE=false, иначе браузер cookie отбросит и войти будет
 * нельзя. По сети тогда открыто идут и пароли, так что HTTPS предпочтительнее.
 */
function secureCookieEnabled(): boolean {
  const configured = process.env.SESSION_COOKIE_SECURE;
  if (configured === "false" || configured === "0") return false;
  if (configured === "true" || configured === "1") return true;
  return process.env.NODE_ENV === "production";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeRole(role: string): Role {
  return role === "ADMIN" ? "ADMIN" : "MEMBER";
}

/**
 * Заводит сессию и кладёт токен в cookie. В базу попадает только хеш токена.
 */
export async function createSession(memberId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      memberId,
      tokenHash: hashToken(token),
      userAgent: userAgent?.slice(0, 200) ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    expires: expiresAt,
    path: "/",
  });
}

/** Гасит текущую сессию: удаляет запись в базе и cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Текущий пользователь или null. Кеш React на запрос: в одном рендере
 * страницы запрос к базе уходит один раз, сколько бы раз ни спросили.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { member: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() || !session.member.isActive) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return {
    id: session.member.id,
    fullName: session.member.fullName,
    displayName: session.member.displayName,
    email: session.member.email,
    position: session.member.position,
    role: normalizeRole(session.member.role),
  };
});

/** Пользователь или переход на вход. Вызывается в начале каждого действия. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** То же, но только для администратора. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Действие доступно только администратору");
  }
  return user;
}

/**
 * Проверка логина и пароля. Возвращает сотрудника или null — без подсказки,
 * что именно не сошлось, чтобы нельзя было перебирать существующие адреса.
 */
export async function authenticate(email: string, password: string) {
  const typed = email.trim();
  // SQLite сравнивает строки с учётом регистра, поэтому ищем и как ввели,
  // и в нижнем регистре: почту в справочник заводили по-разному.
  const member = await prisma.member.findFirst({
    where: { OR: [{ email: typed }, { email: typed.toLowerCase() }] },
  });
  if (!member || !member.isActive) {
    // Тратим время и без пользователя: ответ на несуществующий адрес
    // должен идти столько же, сколько на существующий.
    await verifyPassword(password, null);
    return null;
  }
  const ok = await verifyPassword(password, member.passwordHash);
  return ok ? member : null;
}

/** Чистка просроченных сессий — вызывается при входе. */
export async function purgeExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
