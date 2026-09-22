import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storagePath } from "@/lib/attachments";

/** Выдача вложения. Файлы закрыты так же, как и остальные данные. */
export async function GET(_request: Request, context: RouteContext<"/api/attachments/[id]">) {
  if (!(await getCurrentUser())) {
    return new Response("Требуется вход", { status: 401 });
  }

  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return new Response("Файл не найден", { status: 404 });

  const filePath = storagePath(attachment.storageKey);
  try {
    await stat(filePath);
  } catch {
    return new Response("Файл не найден в хранилище", { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": attachment.mimeType ?? "application/octet-stream",
      "Content-Length": String(attachment.size),
      // filename* — чтобы русские имена файлов доходили целыми.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    },
  });
}
