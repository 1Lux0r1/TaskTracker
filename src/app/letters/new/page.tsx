import Link from "next/link";
import { createLetter } from "@/app/actions/letters";
import { QuickLetterForm, type StickyLetterValues } from "@/components/quick-letter-form";
import { prisma } from "@/lib/db";
import { startOfToday, toDateInputValue } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewLetterPage() {
  await requireUser();
  const [projects, counterparties, members, last, incomingLetters] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    // Следующее письмо чаще всего похоже на предыдущее: подставляем его поля.
    prisma.letter.findFirst({
      orderBy: { createdAt: "desc" },
      select: { projectId: true, direction: true, counterpartyId: true, ownerId: true },
    }),
    // Кандидаты для поля «В ответ на входящее»: форма сама сузит их
    // до выбранного проекта.
    prisma.letter.findMany({
      where: { direction: "INCOMING" },
      orderBy: { date: "desc" },
      select: { id: true, number: true, subject: true, projectId: true },
      take: 300,
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

  const known = last && projects.some((project) => project.id === last.projectId) ? last : null;
  const sticky: StickyLetterValues = {
    projectId: known?.projectId ?? projects[0].id,
    direction: known?.direction ?? "INCOMING",
    date: toDateInputValue(startOfToday()),
    counterpartyId:
      known?.counterpartyId && counterparties.some((item) => item.id === known.counterpartyId)
        ? known.counterpartyId
        : "",
    ownerId:
      known?.ownerId && members.some((item) => item.id === known.ownerId) ? known.ownerId : "",
    status: "IN_PROGRESS",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/letters" className="text-sm text-gray-500 hover:underline">
          ← Переписка
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Внести письмо</h1>
        <p className="text-sm text-gray-500">
          Форма не закрывается после сохранения: проект, направление, дата, организация и
          ответственный остаются для следующего письма.
        </p>
      </div>
      <QuickLetterForm
        action={createLetter}
        projects={projects}
        counterparties={counterparties}
        members={members}
        incomingLetters={incomingLetters}
        sticky={sticky}
      />
    </div>
  );
}
