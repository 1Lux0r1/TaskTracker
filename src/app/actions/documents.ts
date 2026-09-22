"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { deriveDocumentStatus } from "@/lib/domain";
import {
  type ActionResult,
  documentInputSchema,
  formatZodError,
  signatureInputSchema,
} from "@/lib/validation";

/** Стороны, которые заводятся у нового документа по умолчанию. */
const DEFAULT_PARTIES = ["Наша сторона", "Организация"];

export async function createDocument(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = documentInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const document = await prisma.document.create({
    data: {
      ...parsed.data,
      signatures: {
        create: DEFAULT_PARTIES.map((party, index) => ({ party, sortOrder: index })),
      },
    },
  });

  revalidatePath("/documents");
  redirect(`/documents/${document.id}`);
}

export async function updateDocument(
  documentId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = documentInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  await prisma.document.update({
    where: { id: documentId },
    data: {
      ...parsed.data,
      signedAt: parsed.data.status === "SIGNED" ? (await signedAt(documentId)) : null,
    },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  return { ok: true, message: "Документ сохранён" };
}

export async function deleteDocument(formData: FormData): Promise<void> {
  await requireUser();
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  await prisma.document.delete({ where: { id: documentId } });
  revalidatePath("/documents");
  redirect("/documents");
}

export async function addSignature(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = signatureInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  const duplicate = await prisma.documentSignature.findFirst({
    where: { documentId: input.documentId, party: input.party },
  });
  if (duplicate) return { ok: false, error: `Сторона «${input.party}» уже в списке` };

  const last = await prisma.documentSignature.findFirst({
    where: { documentId: input.documentId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.documentSignature.create({
    data: { ...input, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  await syncDocumentStatus(input.documentId);
  revalidatePath(`/documents/${input.documentId}`);
  return { ok: true, message: "Сторона добавлена" };
}

/** Отметка подписи одной стороной прямо из карточки документа. */
export async function setSignatureStatus(formData: FormData): Promise<void> {
  await requireUser();
  const signatureId = String(formData.get("signatureId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!signatureId || !status) return;

  const signature = await prisma.documentSignature.findUnique({ where: { id: signatureId } });
  if (!signature) return;

  await prisma.documentSignature.update({
    where: { id: signatureId },
    data: {
      status,
      signedAt: status === "SIGNED" ? (signature.signedAt ?? new Date()) : null,
    },
  });

  await syncDocumentStatus(signature.documentId);
  revalidatePath(`/documents/${signature.documentId}`);
  revalidatePath("/documents");
}

export async function deleteSignature(formData: FormData): Promise<void> {
  await requireUser();
  const signatureId = String(formData.get("signatureId") ?? "");
  if (!signatureId) return;

  const signature = await prisma.documentSignature.findUnique({ where: { id: signatureId } });
  if (!signature) return;

  await prisma.documentSignature.delete({ where: { id: signatureId } });
  await syncDocumentStatus(signature.documentId);
  revalidatePath(`/documents/${signature.documentId}`);
}

/**
 * Статус документа — производная от подписей сторон, поэтому пересчитывается
 * при каждом их изменении, а не правится руками.
 */
async function syncDocumentStatus(documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { signatures: true },
  });
  if (!document) return;

  const status = deriveDocumentStatus(document.signatures, document.status);
  if (status === document.status) return;

  await prisma.document.update({
    where: { id: documentId },
    data: { status, signedAt: status === "SIGNED" ? (document.signedAt ?? new Date()) : null },
  });
}

async function signedAt(documentId: string): Promise<Date> {
  const current = await prisma.document.findUnique({
    where: { id: documentId },
    select: { signedAt: true },
  });
  return current?.signedAt ?? new Date();
}
