import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteReferencePage, updateReferencePage } from "@/app/actions/reference";
import { ReferenceForm } from "@/components/reference-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { prisma } from "@/lib/db";
import { formatDate, referenceSectionLabel } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReferencePageView(props: PageProps<"/reference/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const page = await prisma.referencePage.findUnique({
    where: { id },
    include: {
      project: { select: { code: true, name: true } },
      author: { select: { fullName: true } },
    },
  });
  if (!page) notFound();

  const [projects, members] = await Promise.all([
    prisma.project.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  const save = updateReferencePage.bind(null, page.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/reference" className="text-sm text-gray-500 hover:underline">
          ← Справочная информация
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{page.title}</h1>
          <span className="badge bg-violet-50 text-violet-700">
            {referenceSectionLabel(page.section)}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {page.project ? `${page.project.code} — ${page.project.name}` : "Общая страница"}
          {page.author && ` · ведёт ${page.author.fullName}`} · обновлена{" "}
          {formatDate(page.updatedAt)}
        </p>
      </div>

      {/* Содержание читают чаще, чем правят, поэтому сначала текст как есть. */}
      <article className="card whitespace-pre-wrap p-5 text-sm leading-6 text-gray-800">
        {page.content}
      </article>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Правка</h2>
        <ReferenceForm
          action={save}
          projects={projects}
          members={members}
          defaults={{
            projectId: page.projectId,
            section: page.section,
            title: page.title,
            content: page.content,
            authorId: page.authorId,
          }}
          submitLabel="Сохранить"
        />
      </section>

      <form action={deleteReferencePage} className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Удалить страницу</h2>
        <p className="text-sm text-gray-500">Действие необратимо.</p>
        <input type="hidden" name="pageId" value={page.id} />
        <ConfirmSubmit>Удалить страницу</ConfirmSubmit>
      </form>
    </div>
  );
}
