import Link from "next/link";
import { createMeeting } from "@/app/actions/meetings";
import { MeetingForm } from "@/components/meeting-form";
import { type NewScreenProps } from "@/components/overlay-panel";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function NewMeetingScreen({ searchParams, inPanel }: NewScreenProps) {
  await requireUser();
  const params = await searchParams;
  // Дата и проект приходят из панели дня в календаре.
  const date = parseDay(single(params.date));
  const projectId = single(params.projectId) ?? "";
  const [projects, members, contacts] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
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

  if (projects.length === 0) {
    return (
      <p className="card p-6 text-sm text-gray-500">
        Сначала создайте проект:{" "}
        <Link href="/projects/new" className="font-medium text-gray-900 hover:underline">
          новый проект
        </Link>
        .
      </p>
    );
  }

  return (
    <div className={inPanel ? "space-y-4" : "mx-auto max-w-4xl space-y-4"}>
      {/* В панели заголовок и возврат рисует сама панель. */}
      {!inPanel && (
        <div>
          <Link href="/meetings" className="text-sm text-gray-500 hover:underline">
            ← Встречи
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новая встреча</h1>
          <p className="text-sm text-gray-500">
            Повестку можно записать заранее, решения и материалы добавить после встречи.
          </p>
        </div>
      )}
      <MeetingForm
        action={createMeeting}
        projects={projects}
        members={members}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          fullName: contact.fullName,
          position: contact.position,
          counterparty: contact.counterparty.name,
        }))}
        defaults={
          date
            ? {
                projectId: projects.some((project) => project.id === projectId)
                  ? projectId
                  : projects[0].id,
                date,
                startTime: null,
                endTime: null,
                place: null,
                kind: "WORKING",
                subject: "",
                agenda: null,
                decisions: null,
                ownerId: null,
                participants: [],
              }
            : undefined
        }
        submitLabel="Завести встречу"
      />
    </div>
  );
}

function parseDay(value: string | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
