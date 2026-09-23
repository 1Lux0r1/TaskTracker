"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NEW_TASK_STATUS } from "@/lib/domain";
import { buildSearchIndex } from "@/lib/search";
import { ensureProjectTracks } from "@/lib/tracks";
import {
  type ActionResult,
  type MeetingInput,
  formatZodError,
  meetingInputSchema,
} from "@/lib/validation";

/**
 * Участники приходят повторяющимися полями формы: свои сотрудники и
 * представители организаций отмечаются галочками, остальные вписываются
 * именем. Пустые строки отбрасываем.
 */
function readParticipants(formData: FormData): {
  memberId: string | null;
  orgContactId: string | null;
  externalName: string | null;
}[] {
  const members = formData
    .getAll("memberId")
    .map(String)
    .filter(Boolean)
    .map((memberId) => ({ memberId, orgContactId: null, externalName: null }));

  const contacts = formData
    .getAll("orgContactId")
    .map(String)
    .filter(Boolean)
    .map((orgContactId) => ({ memberId: null, orgContactId, externalName: null }));

  const guests = formData
    .getAll("externalName")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((externalName) => ({ memberId: null, orgContactId: null, externalName }));

  return [...members, ...contacts, ...guests];
}

function meetingSearchIndex(input: MeetingInput): string {
  return buildSearchIndex([input.subject, input.place, input.agenda, input.decisions]);
}

export async function createMeeting(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = meetingInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  const meeting = await prisma.meeting.create({
    data: {
      ...input,
      searchIndex: meetingSearchIndex(input),
      participants: { create: readParticipants(formData) },
    },
  });

  revalidatePath("/meetings");
  redirect(`/meetings/${meeting.id}`);
}

export async function updateMeeting(
  meetingId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = meetingInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  // Состав участников пересобираем целиком: форма и есть источник правды.
  await prisma.$transaction([
    prisma.meetingParticipant.deleteMany({ where: { meetingId } }),
    prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...input,
        searchIndex: meetingSearchIndex(input),
        participants: { create: readParticipants(formData) },
      },
    }),
  ]);

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true, message: "Встреча сохранена" };
}

export async function deleteMeeting(formData: FormData): Promise<void> {
  await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  if (!meetingId) return;

  await prisma.meeting.delete({ where: { id: meetingId } });
  revalidatePath("/meetings");
  redirect("/meetings");
}

/**
 * Задача из решения встречи. Решения — обычный текст, поэтому формулировку
 * задачи вписывают руками, а связь со встречей проставляется сама: потом
 * видно, откуда работа взялась.
 */
export async function createTaskFromMeeting(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!meetingId || !title) return { ok: false, error: "Укажите, что нужно сделать" };

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, projectId: true, subject: true, date: true },
  });
  if (!meeting) return { ok: false, error: "Встреча не найдена" };

  // Задача из решения кладётся в первый трек проекта: какой именно трек,
  // на встрече не обсуждают, а поменять его можно в карточке задачи.
  await ensureProjectTracks(meeting.projectId);
  const track = await prisma.track.findFirst({
    where: { projectId: meeting.projectId, isArchived: false },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!track) return { ok: false, error: "У проекта нет ни одного трека работ" };

  const last = await prisma.task.findFirst({
    where: { projectId: meeting.projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = (last?.number ?? 0) + 1;

  await prisma.task.create({
    data: {
      projectId: meeting.projectId,
      number,
      sortOrder: number,
      title,
      // Статус новой задачи ставит сервер, как и в обычной форме.
      status: NEW_TASK_STATUS,
      trackId: track.id,
      assigneeId,
      meetingId: meeting.id,
      description: `Решение встречи «${meeting.subject}»`,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`) : null,
      searchIndex: buildSearchIndex([title, meeting.subject]),
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/tasks");
  return { ok: true, message: "Задача заведена" };
}
