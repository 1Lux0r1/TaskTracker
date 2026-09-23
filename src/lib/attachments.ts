import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";

/** Каталог хранения файлов. Меняется переменной ATTACHMENTS_DIR. */
export const ATTACHMENTS_DIR = path.isAbsolute(process.env.ATTACHMENTS_DIR ?? "")
  ? (process.env.ATTACHMENTS_DIR as string)
  : path.join(process.cwd(), process.env.ATTACHMENTS_DIR ?? "var/attachments");

/** Предел размера файла. Он же ограничивает тело запроса в next.config.ts. */
export { MAX_ATTACHMENT_SIZE } from "@/lib/limits";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Имя файла из формы приходит от пользователя: вырезаем пути и управляющие
 * символы, чтобы имя не увело запись за пределы каталога.
 */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : "file";
}

/** Имя файла в каталоге: собственное, никак не связанное с присланным. */
export function buildStorageKey(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase().slice(0, 12);
  return `${randomUUID()}${extension.replace(/[^.a-z0-9]/g, "")}`;
}

export function storagePath(storageKey: string): string {
  // Ключ генерируем сами, но на всякий случай отбрасываем всё, кроме имени.
  return path.join(ATTACHMENTS_DIR, path.basename(storageKey));
}

export async function saveAttachmentFile(storageKey: string, data: ArrayBuffer): Promise<void> {
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  await writeFile(storagePath(storageKey), Buffer.from(data));
}

/** Удаление файла: отсутствующий файл не считается ошибкой. */
export async function removeAttachmentFile(storageKey: string): Promise<void> {
  try {
    await unlink(storagePath(storageKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
