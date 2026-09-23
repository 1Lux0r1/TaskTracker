import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachments";
import { createTaskFromMeeting, deleteMeeting, updateMeeting } from "@/app/actions/meetings";
import { AttachmentPanel } from "@/components/attachment-panel";
import { MeetingForm } from "@/components/meeting-form";
import { MeetingTaskForm } from "@/components/meeting-task-form";
import { SubmitButton } from "@/components/submit-button";
import { formatFileSize } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import {
  formatDate,
  formatMeetingTime,
  meetingKindLabel,
  taskStatusLabel,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MeetingPage(props: PageProps<"/meetings/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      project: { select: { code: true, name: true } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      participants: {
        include: {
          member: { select: { fullName: true } },
          orgContact: {
            select: { fullName: true, position: true, counterparty: { select: { name: true } } },
          },
        },
      },
      tasks: { include: { assignee: true }, orderBy: { number: "asc" } },
    },
  });

  if (!meeting) notFound();

  const [projects, members, contacts] = await Promise.all([
    prisma.project.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.orgContact.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        position: true,
        counterparty: { select: { name: true } },
      },
    }),
  ]);

  const saveMeeting = updateMeeting.bind(null, meeting.id);
  const time = formatMeetingTime(meeting.startTime, meeting.endTime);

  const ours = meeting.participants.filter((item) => item.member);
  const theirs = meeting.participants.filter((item) => item.orgContact);
  const guests = meeting.participants.filter((item) => item.externalName);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/meetings" className="text-sm text-gray-500 hover:underline">
          ← Встречи
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{meeting.subject}</h1>
          <span className="badge bg-violet-50 text-violet-700">
            {meetingKindLabel(meeting.kind)}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {formatDate(meeting.date)}
          {time && ` · ${time}`}
          {meeting.place && ` · ${meeting.place}`} · {meeting.project.code}
        </p>
        {(ours.length > 0 || theirs.length > 0 || guests.length > 0) && (
          <p className="mt-1 text-sm text-gray-500">
            {[
              ours.length > 0 &&
                `наши: ${ours.map((item) => item.member?.fullName).join(", ")}`,
              theirs.length > 0 &&
                `организации: ${theirs
                  .map(
                    (item) =>
                      `${item.orgContact?.fullName} (${item.orgContact?.counterparty.name})`,
                  )
                  .join(", ")}`,
              guests.length > 0 &&
                `остальные: ${guests.map((item) => item.externalName).join(", ")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <MeetingForm
        action={saveMeeting}
        projects={projects}
        members={members}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          fullName: contact.fullName,
          position: contact.position,
          counterparty: contact.counterparty.name,
        }))}
        defaults={{
          projectId: meeting.projectId,
          date: meeting.date,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          place: meeting.place,
          kind: meeting.kind,
          subject: meeting.subject,
          agenda: meeting.agenda,
          decisions: meeting.decisions,
          ownerId: meeting.ownerId,
          participants: meeting.participants.map((item) => ({
            memberId: item.memberId,
            orgContactId: item.orgContactId,
            externalName: item.externalName,
          })),
        }}
        submitLabel="Сохранить"
      />

      <section className="card space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Задачи по решениям</h2>
          <p className="text-sm text-gray-500">
            Решение встречи становится задачей: она попадёт в реестр и будет помнить, откуда взялась.
          </p>
        </div>

        {meeting.tasks.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {meeting.tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <Link href={`/tasks/${task.id}`} className="text-gray-900 hover:underline">
                  #{task.number} {task.title}
                </Link>
                <span className="text-gray-500">{taskStatusLabel(task.status)}</span>
                <span className="ml-auto text-gray-500">
                  {task.assignee?.fullName ?? "без ответственного"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <MeetingTaskForm action={createTaskFromMeeting} meetingId={meeting.id} members={members} />
      </section>

      <AttachmentPanel
        attachments={meeting.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          size: formatFileSize(attachment.size),
          uploadedBy: attachment.uploadedBy?.fullName ?? null,
          createdAt: formatDate(attachment.createdAt),
        }))}
        owner={{ field: "meetingId", id: meeting.id }}
        upload={uploadAttachment}
        remove={deleteAttachment}
      />

      <form action={deleteMeeting} className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Удалить встречу</h2>
        <p className="text-sm text-gray-500">
          Участники и материалы удалятся вместе с ней, заведённые задачи останутся.
          Действие необратимо.
        </p>
        <input type="hidden" name="meetingId" value={meeting.id} />
        <SubmitButton className="btn-danger" pendingLabel="Удаляем…">
          Удалить встречу
        </SubmitButton>
      </form>
    </div>
  );
}
