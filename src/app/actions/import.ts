"use server";

import { revalidatePath } from "next/cache";
import { importFromXlsx, type ImportKind, type ImportReport } from "@/lib/excel/import";

export type ImportState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "done"; report: ImportReport };

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function importFromExcel(
  _state: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const file = formData.get("file");
  const projectId = String(formData.get("projectId") ?? "");
  const kind = (String(formData.get("kind") ?? "tasks") as ImportKind) satisfies ImportKind;

  if (!projectId) return { status: "error", error: "Выберите проект для загрузки" };
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", error: "Выберите файл .xlsx" };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      status: "error",
      error: "Поддерживается только формат .xlsx. Файл .xls нужно пересохранить в Excel",
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { status: "error", error: "Файл больше 15 МБ" };
  }

  try {
    const report = await importFromXlsx(await file.arrayBuffer(), file.name, {
      projectId,
      kind,
      sheetName: String(formData.get("sheetName") ?? "").trim() || undefined,
      createMissingMembers: formData.get("createMissingMembers") === "on",
      createMissingCounterparties: formData.get("createMissingCounterparties") === "on",
      dryRun: formData.get("dryRun") === "on",
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    revalidatePath("/letters");
    return { status: "done", report };
  } catch (error) {
    return {
      status: "error",
      error:
        error instanceof Error
          ? `Не удалось прочитать файл: ${error.message}`
          : "Не удалось прочитать файл",
    };
  }
}
