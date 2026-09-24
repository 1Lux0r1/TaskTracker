import Link from "next/link";
import { createReferencePage } from "@/app/actions/reference";
import { ReferenceForm } from "@/components/reference-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewReferencePage(props: PageProps<"/reference/new">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const section = Array.isArray(params.section) ? params.section[0] : params.section;

  const [projects, members] = await Promise.all([
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
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/reference" className="text-sm text-gray-500 hover:underline">
          ← Справочная информация
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новая страница</h1>
      </div>
      <ReferenceForm
        action={createReferencePage}
        projects={projects}
        members={members}
        defaults={{
          projectId: null,
          section: section ?? "OTHER",
          title: "",
          content: "",
          authorId: user.id,
        }}
        submitLabel="Создать страницу"
      />
    </div>
  );
}
