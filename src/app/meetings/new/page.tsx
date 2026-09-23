import Link from "next/link";
import { createMeeting } from "@/app/actions/meetings";
import { MeetingForm } from "@/components/meeting-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  await requireUser();
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
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/meetings" className="text-sm text-gray-500 hover:underline">
          ← Встречи
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новая встреча</h1>
        <p className="text-sm text-gray-500">
          Повестку можно записать заранее, решения и материалы добавить после встречи.
        </p>
      </div>
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
        submitLabel="Завести встречу"
      />
    </div>
  );
}
