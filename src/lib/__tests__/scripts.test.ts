import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Установочные скрипты запускает не разработчик, а тот, кто ставит систему, и
 * ошибку в них видно только на чужом компьютере. Поэтому здесь проверяется то,
 * что молча ломает запуск.
 */
const SCRIPTS = path.join(process.cwd(), "scripts");

describe("скрипты PowerShell", () => {
  const files = readdirSync(SCRIPTS).filter((name) => name.endsWith(".ps1"));

  it("в комплекте есть скрипты PowerShell", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const name of files) {
    // Windows PowerShell 5.1 без BOM читает файл как cp1251: русские
    // комментарии и сообщения превращаются в кракозябры, а байт 0x94 внутри
    // букв «Д» и «Г» становится кавычкой и обрывает строку кода.
    it(`${name} сохранён в UTF-8 с BOM`, () => {
      const head = readFileSync(path.join(SCRIPTS, name)).subarray(0, 3);
      expect([...head]).toEqual([0xef, 0xbb, 0xbf]);
    });
  }
});

describe("скрипты bash", () => {
  const files = readdirSync(SCRIPTS).filter((name) => name.endsWith(".sh"));

  for (const name of files) {
    // С переводом строки Windows ядро не находит интерпретатор и отвечает
    // «bad interpreter», а с BOM bash спотыкается на первой же строке.
    it(`${name} без BOM и без переводов строки Windows`, () => {
      const source = readFileSync(path.join(SCRIPTS, name));
      expect(source.subarray(0, 3).toString("hex")).not.toBe("efbbbf");
      expect(source.includes("\r\n")).toBe(false);
    });
  }
});
