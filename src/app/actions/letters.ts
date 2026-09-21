"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CLOSED_LETTER_STATUSES, type LetterStatus } from "@/lib/domain";
import { buildLetterSearchIndex } from "@/lib/search";
import { type ActionResult, formatZodError, letterInputSchema } from "@/lib/validation";

export async function createLetter(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = letterInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  const duplicate = await prisma.letter.findFirst({
    where: { projectId: input.projectId, number: input.number, direction: input.direction },
  });
  if (duplicate) {
    return { ok: false, error: `Письмо № ${input.number} уже заведено в этом проекте` };
  }

  const letter = await prisma.letter.create({
    data: {
      ...input,
      closedAt: closedAtFor(input.status, null),
      searchIndex: await searchIndexFor(input),
    },
  });
  revalidatePath("/letters");
  redirect(`/letters/${letter.id}`);
}

export async function updateLetter(
  letterId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = letterInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const current = await prisma.letter.findUnique({ where: { id: letterId } });
  if (!current) return { ok: false, error: "Письмо не найдено" };

  const input = parsed.data;
  const duplicate = await prisma.letter.findFirst({
    where: {
      projectId: input.projectId,
      number: input.number,
      direction: input.direction,
      id: { not: letterId },
    },
  });
  if (duplicate) {
    return { ok: false, error: `Письмо № ${input.number} уже заведено в этом проекте` };
  }

  await prisma.letter.update({
    where: { id: letterId },
    data: {
      ...input,
      closedAt: closedAtFor(input.status, current),
      searchIndex: await searchIndexFor(input),
    },
  });
  revalidatePath("/letters");
  revalidatePath(`/letters/${letterId}`);
  return { ok: true, message: "Письмо сохранено" };
}

export async function deleteLetter(formData: FormData): Promise<void> {
  const letterId = String(formData.get("letterId") ?? "");
  if (!letterId) return;

  await prisma.letter.delete({ where: { id: letterId } });
  revalidatePath("/letters");
  redirect("/letters");
}

/** Поисковая строка собирается из всего, по чему реально ищут письмо. */
async function searchIndexFor(input: {
  number: string;
  subject: string;
  counterpartyId: string | null;
  responseRef: string | null;
  statusNote: string | null;
  comment: string | null;
  externalTaskKey: string | null;
}): Promise<string> {
  const counterparty = input.counterpartyId
    ? await prisma.counterparty.findUnique({
        where: { id: input.counterpartyId },
        select: { name: true, shortName: true },
      })
    : null;

  return buildLetterSearchIndex([
    input.number,
    input.subject,
    counterparty?.name,
    counterparty?.shortName,
    input.responseRef,
    input.statusNote,
    input.comment,
    input.externalTaskKey,
  ]);
}

/** Дата закрытия ставится при переходе в отработанный статус и снимается при возврате. */
function closedAtFor(
  nextStatus: string,
  current: { status: string; closedAt: Date | null } | null,
): Date | null {
  const closed = CLOSED_LETTER_STATUSES.includes(nextStatus as LetterStatus);
  if (!closed) return null;
  const wasClosed =
    current !== null && CLOSED_LETTER_STATUSES.includes(current.status as LetterStatus);
  return wasClosed ? current.closedAt : new Date();
}
