"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MAX_ATTACHMENT_SIZE,
  buildStorageKey,
  formatFileSize,
  removeAttachmentFile,
  safeFileName,
  saveAttachmentFile,
} from "@/lib/attachments";
import type { ActionResult } from "@/lib/validation";

/** К чему крепим файл: у вложения заполнено ровно одно из полей. */
const OWNERS = ["taskId", "letterId", "documentId", "meetingId"] as const;

type Owner = (typeof OWNERS)[number];

function readOwner(formData: FormData): { field: Owner; id: string } | null {
  for (const field of OWNERS) {
    const id = formData.get(field);
    if (typeof id === "string" && id.length > 0) return { field, id };
  }
  return null;
}

export async function uploadAttachment(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const owner = readOwner(formData);
  if (!owner) return { ok: false, error: "Непонятно, к чему прикрепить файл" };

  const files = formData.getAll("file").filter((item): item is File => item instanceof File);
  const chosen = files.filter((file) => file.size > 0);
  if (chosen.length === 0) return { ok: false, error: "Выберите файл" };

  const tooBig = chosen.find((file) => file.size > MAX_ATTACHMENT_SIZE);
  if (tooBig) {
    return {
      ok: false,
      error: `Файл «${safeFileName(tooBig.name)}» больше ${formatFileSize(MAX_ATTACHMENT_SIZE)}`,
    };
  }

  for (const file of chosen) {
    const fileName = safeFileName(file.name);
    const storageKey = buildStorageKey(fileName);
    await saveAttachmentFile(storageKey, await file.arrayBuffer());
    await prisma.attachment.create({
      data: {
        fileName,
        mimeType: file.type || null,
        size: file.size,
        storageKey,
        uploadedById: user.id,
        [owner.field]: owner.id,
      },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/letters");
  revalidatePath("/documents");
  revalidatePath("/meetings");
  return {
    ok: true,
    message: chosen.length === 1 ? "Файл прикреплён" : `Прикреплено файлов: ${chosen.length}`,
  };
}

/** Удаление вложения: сначала запись, потом файл на диске. */
export async function deleteAttachment(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("attachmentId") ?? "");
  if (!id) return;

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return;

  await prisma.attachment.delete({ where: { id } });
  await removeAttachmentFile(attachment.storageKey);

  revalidatePath("/tasks");
  revalidatePath("/letters");
  revalidatePath("/documents");
  revalidatePath("/meetings");
}
