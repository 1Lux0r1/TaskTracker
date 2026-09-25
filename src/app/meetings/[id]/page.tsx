import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachments";
import { createTaskFromMeeting, deleteMeeting, updateMeeting } from "@/app/actions/meetings";
import { AttachmentPanel } from "@/components/attachment-panel";
import { MeetingForm } from "@/components/meeting-form";
import { MeetingTaskForm } from "@/components/meeting-task-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatFileSize } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import {
  formatDate,
  formatMeetingTime,
  meetingKindLabel,
  taskStatusLabel,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";
import { Prop, SectionCap, Who } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MeetingPage(props: PageProps<"/meetings/[id]">) {
  await requireUser();
  const { id } = await props.params;
  const editing = (await props.searchParams).edit === "1";

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
      owner: { select: { fullName: true } },
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
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <Link href="/meetings" className="text-sm text-gray-500 hover:underline">
            ← Встречи · {meetingKindLabel(meeting.kind)} · {meeting.project.code}
          </Link>
          <h1 className="mt-1 text-[25px] leading-tight font-bold text-gray-900">{meeting.subject}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={deleteMeeting}>
            <input type="hidden" name="meetingId" value={meeting.id} />
            <ConfirmSubmit question="Удалить встречу? Заведённые задачи останутся.">Удалить</ConfirmSubmit>
          </form>
          {editing ? (
            <Link href={`/meetings/${meeting.id}`} className="btn-secondary">
              Готово
            </Link>
          ) : (
            <Link href={`/meetings/${meeting.id}?edit=1`} className="btn-primary">
              Редактировать
            </Link>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {editing ? (
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
          ) : (
            <section className="card space-y-5 p-[18px]">
              <div className="grid grid-cols-2 gap-2.5">
                <Prop label="Дата и время">
                  <span className="font-mono">
                    {formatDate(meeting.date)}
                    {time && ` ${time}`}
                  </span>
                </Prop>
                <Prop label="Место">
                  {meeting.place ?? <span className="text-gray-500">не указано</span>}
                </Prop>
                <Prop label="Участники">
                  {ours.length + theirs.length + guests.length === 0 ? (
                    <span className="text-gray-500">не отмечены</span>
                  ) : (
                    <span className="text-[13.5px]">
                      {[
                        ...ours.map((item) => item.member?.fullName),
                        ...theirs.map(
                          (item) => `${item.orgContact?.fullName} (${item.orgContact?.counterparty.name})`,
                        ),
                        ...guests.map((item) => item.externalName),
                      ].join(", ")}
                    </span>
                  )}
                </Prop>
                <Prop label="Кто ведёт запись">
                  <Who name={meeting.owner?.fullName} empty="не назначен" />
                </Prop>
              </div>

              <div>
                <SectionCap>Повестка</SectionCap>
                {meeting.agenda ? (
                  <p className="text-sm whitespace-pre-line text-gray-900">{meeting.agenda}</p>
                ) : (
                  <p className="text-sm text-gray-500">не внесена</p>
                )}
              </div>

              <div>
                <SectionCap>Решения</SectionCap>
                {meeting.decisions ? (
                  <p className="text-sm whitespace-pre-line text-gray-900">{meeting.decisions}</p>
                ) : (
                  <p className="text-sm text-gray-500">не внесены</p>
                )}
              </div>
            </section>
          )}

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
        </div>

        <div className="min-w-0 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
