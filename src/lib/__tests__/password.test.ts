import { describe, expect, it } from "vitest";
import { checkPasswordRules, hashPassword, verifyPassword } from "@/lib/password";

describe("пароли", () => {
  it("подтверждает верный пароль", async () => {
    const hash = await hashPassword("Пароль-2026");
    expect(await verifyPassword("Пароль-2026", hash)).toBe(true);
  });

  it("отклоняет неверный пароль", async () => {
    const hash = await hashPassword("Пароль-2026");
    expect(await verifyPassword("пароль-2026", hash)).toBe(false);
  });

  it("даёт разные хеши одному паролю", async () => {
    const first = await hashPassword("Пароль-2026");
    const second = await hashPassword("Пароль-2026");
    expect(first).not.toBe(second);
  });

  it("не пускает без хеша", async () => {
    expect(await verifyPassword("что угодно", null)).toBe(false);
    expect(await verifyPassword("что угодно", "мусор")).toBe(false);
    expect(await verifyPassword("что угодно", "scrypt$aa$bb")).toBe(false);
  });

  it("требует длину и не только цифры", () => {
    expect(checkPasswordRules("короткий")).toBeNull();
    expect(checkPasswordRules("1234567")).toContain("короче");
    expect(checkPasswordRules("12345678")).toContain("цифр");
  });
});
