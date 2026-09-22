import { describe, expect, it } from "vitest";
import { buildStorageKey, formatFileSize, safeFileName, storagePath } from "@/lib/attachments";

describe("вложения", () => {
  it("вырезает путь из присланного имени", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\ivanov\\договор.pdf")).toBe("договор.pdf");
  });

  it("не оставляет пустого имени", () => {
    expect(safeFileName("   ")).toBe("file");
    expect(safeFileName("/")).toBe("file");
  });

  it("имя в хранилище своё, расширение сохраняется", () => {
    const key = buildStorageKey("договор.PDF");
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(key).not.toContain("договор");
  });

  it("путь хранения не выходит за каталог", () => {
    expect(storagePath("../../secret")).toMatch(/[/\\]secret$/);
    expect(storagePath("../../secret")).not.toContain("..");
  });

  it("показывает размер по-человечески", () => {
    expect(formatFileSize(512)).toBe("512 Б");
    expect(formatFileSize(2048)).toBe("2 КБ");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 МБ");
  });
});
