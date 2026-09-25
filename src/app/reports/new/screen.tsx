import Link from "next/link";
import { createReport } from "@/app/actions/reports";
import { ReportForm } from "@/components/report-form";
import { type NewScreenProps } from "@/components/overlay-panel";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function NewReportScreen({ inPanel }: NewScreenProps) {
  await requireUser();
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

  const today = new Date();
  const twoWeeksAgo = new Date(today.getTime() - 14 * 86_400_000);

  return (
    <div className={inPanel ? "space-y-4" : "mx-auto max-w-4xl space-y-4"}>
      {/* В панели заголовок и возврат рисует сама панель. */}
      {!inPanel && (
        <div>
          <Link href="/reports" className="text-sm text-gray-500 hover:underline">
            ← Отчёты
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новый отчёт</h1>
        </div>
      )}
      <ReportForm
        action={createReport}
        projects={projects}
        members={members}
        defaults={{
          projectId: projects[0].id,
          periodStart: twoWeeksAgo,
          periodEnd: today,
          releaseInfo: null,
          done: null,
          planned: null,
          blockers: null,
          solutions: null,
          authorId: null,
        }}
        submitLabel="Создать отчёт"
      />
    </div>
  );
}
