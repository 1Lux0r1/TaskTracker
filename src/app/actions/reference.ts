"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildSearchIndex } from "@/lib/search";
import {
  type ActionResult,
  type ReferencePageInput,
  formatZodError,
  referencePageInputSchema,
} from "@/lib/validation";

function referenceSearchIndex(input: ReferencePageInput): string {
  return buildSearchIndex([input.title, input.content]);
}

export async function createReferencePage(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = referencePageInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  const page = await prisma.referencePage.create({
    data: {
      ...input,
      // Автор по умолчанию тот, кто пишет: поле в форме можно не трогать.
      authorId: input.authorId ?? user.id,
      searchIndex: referenceSearchIndex(input),
    },
  });

  revalidatePath("/reference");
  redirect(`/reference/${page.id}`);
}

export async function updateReferencePage(
  pageId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = referencePageInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  await prisma.referencePage.update({
    where: { id: pageId },
    data: { ...input, searchIndex: referenceSearchIndex(input) },
  });

  revalidatePath("/reference");
  revalidatePath(`/reference/${pageId}`);
  return { ok: true, message: "Страница сохранена" };
}

export async function deleteReferencePage(formData: FormData): Promise<void> {
  await requireUser();
  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) return;

  await prisma.referencePage.delete({ where: { id: pageId } });
  revalidatePath("/reference");
  redirect("/reference");
}
