import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Минимальная длина пароля: короче нельзя завести ни себе, ни сотруднику. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Хеш пароля в виде `scrypt$<соль>$<ключ>`. Соль своя у каждого пароля,
 * поэтому одинаковые пароли дают разные хеши.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = (await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Сверяет пароль с хешем. Сравнение постоянного времени, без утечки по таймингу. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;
  const key = (await scryptAsync(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    KEY_LENGTH,
  )) as Buffer;
  return timingSafeEqual(key, expected);
}

/** Проверка пароля при заведении. Возвращает текст ошибки или null. */
export function checkPasswordRules(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль короче ${MIN_PASSWORD_LENGTH} символов`;
  }
  if (!/[^0-9]/.test(password)) {
    return "Пароль из одних цифр слишком простой";
  }
  return null;
}
