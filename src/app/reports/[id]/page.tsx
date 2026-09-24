import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteReport, submitReport, updateReport } from "@/app/actions/reports";
import { ReportForm } from "@/components/report-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { formatDate, formatPeriod } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportPage(props: PageProps<"/reports/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const report = await prisma.weeklyReport.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!report) notFound();

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

  const saveReport = updateReport.bind(null, report.id);
  const submitted = report.state === "SUBMITTED";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/reports" className="text-sm text-gray-500 hover:underline">
            ← Отчёты
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {report.project.name}
          </h1>
          <p className="text-sm text-gray-500">
            Период {formatPeriod(report.periodStart, report.periodEnd)}
          </p>
        </div>
        <Link href={`/api/export?entity=report&reportId=${report.id}`} className="btn-secondary">
          Выгрузить в Excel
        </Link>
      </div>

      {submitted ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Отчёт отправлен {formatDate(report.submittedAt)} и заморожен. Так он навсегда
          совпадает с тем, что ушло руководству.
        </p>
      ) : (
        <form action={submitReport} className="card flex flex-wrap items-center gap-3 p-4">
          <p className="flex-1 text-sm text-gray-600">
            После отправки отчёт замораживается и больше не правится.
          </p>
          <input type="hidden" name="reportId" value={report.id} />
          <SubmitButton pendingLabel="Отправляем…">Пометить отправленным</SubmitButton>
        </form>
      )}

      <ReportForm
        action={saveReport}
        projects={projects}
        members={members}
        defaults={report}
        readOnly={submitted}
        submitLabel="Сохранить"
      />

      <form action={deleteReport} className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Удалить отчёт</h2>
        <p className="text-sm text-gray-500">Действие необратимо.</p>
        <input type="hidden" name="reportId" value={report.id} />
        <ConfirmSubmit>Удалить отчёт</ConfirmSubmit>
      </form>
    </div>
  );
}
