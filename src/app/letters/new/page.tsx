import Link from "next/link";
import { createLetter } from "@/app/actions/letters";
import { LetterForm } from "@/components/letter-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewLetterPage() {
  const [projects, counterparties, members] = await Promise.all([
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
        <Link href="/letters" className="text-sm text-gray-500 hover:underline">
          ← Переписка
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новое письмо</h1>
      </div>
      <LetterForm
        action={createLetter}
        projects={projects}
        counterparties={counterparties}
        members={members}
        submitLabel="Сохранить письмо"
      />
    </div>
  );
}
