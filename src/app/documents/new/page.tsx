import Link from "next/link";
import { createDocument } from "@/app/actions/documents";
import { DocumentForm } from "@/components/document-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const [projects, counterparties, members, letters] = await Promise.all([
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
    prisma.letter.findMany({
      orderBy: { date: "desc" },
      select: { id: true, number: true, direction: true, subject: true },
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

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/documents" className="text-sm text-gray-500 hover:underline">
          ← Документы
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новый документ</h1>
        <p className="mt-1 text-sm text-gray-500">
          После создания добавьте стороны подписания — статус документа считается по ним.
        </p>
      </div>
      <DocumentForm
        action={createDocument}
        projects={projects}
        counterparties={counterparties}
        members={members}
        letters={letters}
        submitLabel="Создать документ"
      />
    </div>
  );
}
