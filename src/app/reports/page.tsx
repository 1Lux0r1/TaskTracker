import Link from "next/link";
import { generateReport } from "@/app/actions/reports";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { formatPeriod } from "@/lib/domain";
import { requireUser } from "@/lib/auth";
import { Block, Pill } from "@/components/ui";

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
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-[25px] leading-tight font-bold text-gray-900">Отчёты руководству</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
            Черновик собирается из данных проекта за период, дальше правится руками. Отправленная
            версия замораживается.
          </p>
        </div>
        <Link href="/reports/new" className="btn-secondary">
          Пустой отчёт
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Block
          tone="violet"
          icon="clock"
          title="Отчёты по периодам"
          sub="Отправленные версии заморожены, черновики можно править"
          flush
        >
          {reports.length === 0 ? (
            <p className="px-[18px] pb-[18px] text-sm text-gray-500">Отчётов пока нет.</p>
          ) : (
            <ul className="divide-y divide-gray-200 border-t border-gray-200">
              {reports.map((report) => (
                <li key={report.id} className="relative flex items-start gap-4 px-[18px] py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/reports/${report.id}`}
                      className="font-mono text-[13.5px] text-gray-900 tabular-nums after:absolute after:inset-0 after:content-['']"
                    >
                      {formatPeriod(report.periodStart, report.periodEnd)}
                    </Link>
                    <p className="text-[12.5px] text-gray-500">
                      {[report.project.code, report.author?.fullName].filter(Boolean).join(" · ")}
                    </p>
                    {report.done && (
                      <p className="mt-1 line-clamp-2 text-[13px] text-gray-600">{report.done}</p>
                    )}
                  </div>
                  <Pill tone={report.state === "SUBMITTED" ? "good" : "brand"}>
                    {report.state === "SUBMITTED" ? "Отправлен" : "Черновик"}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block tone="brand" icon="file" title="Собрать черновик" sub="Выполненное, блокеры и переписка подставятся из данных">
          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">Нет действующих проектов.</p>
          ) : (
            <form action={generateReport} className="space-y-3">
              <label className="field">
                Проект
                <select name="projectId" defaultValue={projects[0].id} className="input">
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} — {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Период
                <select name="weeks" defaultValue="2" className="input">
                  <option value="1">Неделя</option>
                  <option value="2">Две недели</option>
                </select>
              </label>
              <SubmitButton pendingLabel="Собираем…">Собрать черновик</SubmitButton>
            </form>
          )}
        </Block>
      </div>
    </div>
  );
}
