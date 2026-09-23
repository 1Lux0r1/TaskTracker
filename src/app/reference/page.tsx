import Link from "next/link";
import { prisma } from "@/lib/db";
import { REFERENCE_SECTIONS, formatDate } from "@/lib/domain";
import { normalizeQuery } from "@/lib/search";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReferencePage(props: PageProps<"/reference">) {
  await requireUser();
  const params = await props.searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const terms = normalizeQuery(query).split(" ").filter(Boolean).slice(0, 5);

  const pages = await prisma.referencePage.findMany({
    where:
      terms.length > 0
        ? { AND: terms.map((term) => ({ searchIndex: { contains: term } })) }
        : {},
    include: {
      project: { select: { code: true } },
      author: { select: { fullName: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/directory" className="text-sm text-gray-500 hover:underline">
            ← Справочники
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Справочная информация</h1>
          <p className="text-sm text-gray-500">
            Архитектура системы, паспорт проекта, матрица подписания и порядок работы —
            рядом с работой, а не в чужих файлах
          </p>
        </div>
        <Link href="/reference/new" className="btn-primary">
          Новая страница
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <label className="field">
          Поиск
          <input
            name="q"
            defaultValue={query}
            placeholder="заголовок или текст"
            className="input w-64"
          />
        </label>
        <button type="submit" className="btn-secondary">
          Найти
        </button>
        {query && (
          <Link href="/reference" className="btn-secondary">
            Сбросить
          </Link>
        )}
      </form>

      {pages.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          {query ? "Под запрос ничего не подошло." : "Страниц пока нет."}
        </p>
      ) : (
        <div className="space-y-4">
          {REFERENCE_SECTIONS.map((section) => {
            const rows = pages.filter((page) => page.section === section.value);
            if (rows.length === 0) return null;

            return (
              <section key={section.value} className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  {section.label}
                  <span className="ml-2 font-normal text-gray-400">{rows.length}</span>
                </h2>
                <ul className="grid gap-2 md:grid-cols-2">
                  {rows.map((page) => (
                    <li key={page.id}>
                      <Link
                        href={`/reference/${page.id}`}
                        className="card block h-full min-w-0 p-4 transition hover:border-gray-300 hover:shadow-sm"
                      >
                        <p className="font-medium text-gray-900">{page.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{page.content}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          {page.project ? page.project.code : "общая"}
                          {page.author && ` · ведёт ${page.author.fullName}`} · обновлена{" "}
                          {formatDate(page.updatedAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
