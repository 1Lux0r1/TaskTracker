"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { backupPaths, createBackup, restoreBackup } from "@/lib/backup";
import { prisma } from "@/lib/db";
import { reindexSearch } from "@/lib/search-reindex";
import type { ActionResult } from "@/lib/validation";

/**
 * Обслуживание системы кнопками: то, что раньше делалось командами
 * `npm run backup` и `npm run search:reindex`. Всё только администратору.
 */

function failure(error: unknown, fallback: string): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

export async function makeBackup(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const created = await createBackup(backupPaths());
    revalidatePath("/maintenance");
    const removed =
      created.removed.length > 0 ? ` Старые копии сверх предела удалены: ${created.removed.length}.` : "";
    return { ok: true, message: `Копия снята и проверена.${removed}` };
  } catch (error) {
    return failure(error, "Копию снять не удалось");
  }
}

export async function restoreFromBackup(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "");
  try {
    const restored = await restoreBackup(backupPaths(), name);
    // Восстановленная база несёт свои поисковые строки, но пересобрать их
    // дёшево, а молча пустой русский поиск обходится дороже.
    await reindexSearch(prisma);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        `Данные восстановлены из копии ${restored.name}. ` +
        `Прежнее состояние сохранено копией ${restored.safetyCopy}. ` +
        "Если вход в копии другой, система попросит войти заново.",
    };
  } catch (error) {
    return failure(error, "Восстановить не удалось");
  }
}

export async function rebuildSearch(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const counts = await reindexSearch(prisma);
    revalidatePath("/maintenance");
    return {
      ok: true,
      message:
        `Поиск пересобран: задач ${counts.tasks}, писем ${counts.letters}, ` +
        `документов ${counts.documents}, встреч ${counts.meetings}, страниц ${counts.pages}.`,
    };
  } catch (error) {
    return failure(error, "Пересобрать поиск не удалось");
  }
}
