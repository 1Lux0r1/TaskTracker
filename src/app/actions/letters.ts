"use server";

import { requireUser } from "@/lib/auth";
import { applyVisibilityChange } from "@/lib/visibility-log";
import { notifyDueChange } from "@/lib/notifications-feed";
import { VISIBILITY_DEFAULTS, readVisibility } from "@/lib/visibility";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CLOSED_LETTER_STATUSES, type LetterStatus } from "@/lib/domain";
import { normalizeLetterByDirection } from "@/lib/letters";
import { buildSearchIndex } from "@/lib/search";
import {
  type ActionResult,
  formatZodError,
  letterInputSchema,
} from "@/lib/validation";

/**
 * Форма быстрого внесения не уходит со страницы: реестр переписки заполняют
 * пачками, поэтому действие возвращает список уже внесённых писем, а форма
 * сохраняет повторяющиеся поля.
 */
export type QuickLetterState = {
  ok: boolean;
  error?: string;
  saved: { id: string; number: string; subject: string }[];
};

export async function createLetter(
  state: QuickLetterState | null,
  formData: FormData,
): Promise<QuickLetterState> {
  await requireUser();
  const saved = state?.saved ?? [];
  const parsed = letterInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error), saved };

  const input = normalizeLetterByDirection(parsed.data, {
    answerNotRequired: formData.get("answerNotRequired") === "on",
  });
  if (!(await answerBelongsToProject(input.responseToId, input.projectId))) {
    return { ok: false, error: "Письмо-основание относится к другому проекту", saved };
  }
  // Номер письма повторяется в разные годы, поэтому дубль ищем по номеру и дате.
  const duplicate = await prisma.letter.findFirst({
    where: {
      projectId: input.projectId,
      number: input.number,
      direction: input.direction,
      date: input.date,
    },
  });
  if (duplicate) {
    return { ok: false, error: `Письмо № ${input.number} от этой даты уже заведено`, saved };
  }

  const letter = await prisma.letter.create({
    data: {
      ...input,
      // Видимость сотрудник задаёт один раз — при заведении.
      isPublic: readVisibility(formData) ?? VISIBILITY_DEFAULTS.LETTER,
      closedAt: closedAtFor(input.status, null),
      searchIndex: await searchIndexFor(input),
    },
  });
  revalidatePath("/letters");
  return {
    ok: true,
    saved: [{ id: letter.id, number: letter.number, subject: letter.subject }, ...saved].slice(0, 25),
  };
}

export async function updateLetter(
  letterId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = letterInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const current = await prisma.letter.findUnique({ where: { id: letterId } });
  if (!current) return { ok: false, error: "Письмо не найдено" };

  const input = normalizeLetterByDirection(parsed.data, {
    answerNotRequired: formData.get("answerNotRequired") === "on",
    selfId: letterId,
  });
  if (!(await answerBelongsToProject(input.responseToId, input.projectId))) {
    return { ok: false, error: "Письмо-основание относится к другому проекту" };
  }
  const duplicate = await prisma.letter.findFirst({
    where: {
      projectId: input.projectId,
      number: input.number,
      direction: input.direction,
      date: input.date,
      id: { not: letterId },
    },
  });
  if (duplicate) {
    return { ok: false, error: `Письмо № ${input.number} от этой даты уже заведено` };
  }

  const visibility = await applyVisibilityChange(
    user,
    "LETTER",
    letterId,
    `№ ${input.number} — ${input.subject}`,
    current.isPublic,
    formData,
  );

  await prisma.letter.update({
    where: { id: letterId },
    data: {
      ...input,
      ...visibility,
      closedAt: closedAtFor(input.status, current),
      searchIndex: await searchIndexFor(input),
    },
  });
  if (input.dueDate?.getTime() !== current.dueDate?.getTime()) {
    await notifyDueChange(
      "LETTER",
      letterId,
      `№ ${input.number} — ${input.subject}`,
      input.ownerId,
      input.projectId,
      input.dueDate,
      user.id,
    );
  }

  revalidatePath("/letters");
  revalidatePath(`/letters/${letterId}`);
  return { ok: true, message: "Письмо сохранено" };
}

export async function deleteLetter(formData: FormData): Promise<void> {
  await requireUser();
  const letterId = String(formData.get("letterId") ?? "");
  if (!letterId) return;

  await prisma.letter.delete({ where: { id: letterId } });
  revalidatePath("/letters");
  redirect("/letters");
}

/**
 * Цепочка переписки живёт внутри проекта: ссылка «в ответ на» на письмо
 * другого проекта смешала бы реестры, поэтому её не сохраняем.
 */
async function answerBelongsToProject(
  responseToId: string | null,
  projectId: string,
): Promise<boolean> {
  if (!responseToId) return true;
  const found = await prisma.letter.findFirst({
    where: { id: responseToId, projectId },
    select: { id: true },
  });
  return found !== null;
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

  return buildSearchIndex([
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
