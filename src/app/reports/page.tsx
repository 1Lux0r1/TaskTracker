import Link from "next/link";
import { generateReport } from "@/app/actions/reports";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { formatPeriod } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireUser();
  const [reports, projects] = await Promise.all([
    prisma.weeklyReport.findMany({
      include: { project: true, author: true },
      orderBy: { periodEnd: "desc" },
      take: 50,
    }),
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Отчёты руководству</h1>
          <p className="text-sm text-gray-500">
            Черновик собирается из данных проекта за период, дальше правится руками
          </p>
        </div>
        <Link href="/reports/new" className="btn-secondary">
          Пустой отчёт
        </Link>
      </div>

      {projects.length > 0 && (
        <form action={generateReport} className="card flex flex-wrap items-end gap-3 p-4">
          <label className="field">
            Проект
            <select name="projectId" defaultValue={projects[0].id} className="input w-64">
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Период
            <select name="weeks" defaultValue="2" className="input w-44">
              <option value="1">Неделя</option>
              <option value="2">Две недели</option>
            </select>
          </label>
          <SubmitButton pendingLabel="Собираем…">Собрать черновик</SubmitButton>
        </form>
      )}

      {reports.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Отчётов пока нет.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-head w-24">Проект</th>
                <th className="table-head w-64">Период</th>
                <th className="table-head w-36">Состояние</th>
                <th className="table-head w-48">Автор</th>
                <th className="table-head">Начало сводки</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-gray-500">{report.project.code}</td>
                  <td className="table-cell">
                    <Link
                      href={`/reports/${report.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {formatPeriod(report.periodStart, report.periodEnd)}
                    </Link>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`badge ${
                        report.state === "SUBMITTED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {report.state === "SUBMITTED" ? "Отправлен" : "Черновик"}
                    </span>
                  </td>
                  <td className="table-cell">{report.author?.fullName ?? "—"}</td>
                  <td className="table-cell">
                    <span className="line-clamp-2 text-xs text-gray-500">
                      {report.done?.slice(0, 160) ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
