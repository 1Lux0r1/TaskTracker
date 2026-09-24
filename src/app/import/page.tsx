import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { prisma } from "@/lib/db";
import { LETTER_COLUMNS, TASK_COLUMNS } from "@/lib/excel/columns";
import { formatDate } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireUser();
  const [projects, history] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Импорт из Excel</h1>
        <p className="mt-1 text-sm text-gray-600">
          Загрузите существующий файл .xlsx — задачи попадут в выбранный проект. Повторная
          загрузка того же файла обновит задачи, а не продублирует их.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          Сначала создайте проект:{" "}
          <Link href="/projects/new" className="font-medium text-gray-900 hover:underline">
            новый проект
          </Link>
          .
        </p>
      ) : (
        <ImportForm projects={projects} isAdmin={user.role === "ADMIN"} />
      )}

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Какие колонки распознаются</h2>
        <p className="text-sm text-gray-600">
          Шапка ищется в первых десяти строках листа — над таблицей часто стоит название
          отчёта. Названия колонок сопоставляются по синонимам, регистр и «ё» не мешают.
          Строки итогов пропускаются.
        </p>
        <p className="text-sm text-gray-600">
          Если колонка «Статус» в вашем файле ведётся как журнал с датами
          («05.05.2026 драфт загружен в ЭДО»), он разбирается на записи хроники: текст
          сохраняется целиком, а даты событий попадают в ленту задачи.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Реестр задач
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {TASK_COLUMNS.map((column) => (
                <li key={column.key}>
                  <span className="font-medium">{column.header}</span>
                  <span className="text-gray-500"> — {column.aliases.slice(0, 3).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Реестр переписки ЭДО
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {LETTER_COLUMNS.map((column) => (
                <li key={column.key}>
                  <span className="font-medium">{column.header}</span>
                  <span className="text-gray-500"> — {column.aliases.slice(0, 3).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Link href="/api/export?template=1" className="btn-secondary w-fit">
          Скачать файл-образец
        </Link>
      </section>

      {history.length > 0 && (
        <section className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-head">Файл</th>
                <th className="table-head w-32">Дата</th>
                <th className="table-head w-24">Строк</th>
                <th className="table-head w-28">Создано</th>
                <th className="table-head w-28">Обновлено</th>
                <th className="table-head w-28">Пропущено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((batch) => (
                <tr key={batch.id}>
                  <td className="table-cell">{batch.fileName}</td>
                  <td className="table-cell tabular-nums">{formatDate(batch.createdAt)}</td>
                  <td className="table-cell tabular-nums">{batch.rowsTotal}</td>
                  <td className="table-cell tabular-nums">{batch.rowsCreated}</td>
                  <td className="table-cell tabular-nums">{batch.rowsUpdated}</td>
                  <td className="table-cell tabular-nums">{batch.rowsSkipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
