import Link from "next/link";
import {
  addIntegrationRow,
  removeIntegrationRow,
  saveIntegrationRow,
} from "@/app/actions/integrations";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { IntegrationRowForm } from "@/components/integration-row-form";
import { IntegrationStartForm } from "@/components/integration-start-form";
import { prisma } from "@/lib/db";
import {
  INTEGRATION_STAGES,
  type MilestoneState,
  formatDate,
  integrationProgress,
  milestoneState,
  plural,
  startOfToday,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Цвет клетки: факт зелёный, просрочка красная, ближайшая неделя оранжевая. */
const CELL: Record<MilestoneState, string> = {
  done: "bg-emerald-50 text-emerald-800",
  overdue: "bg-red-50 text-red-800",
  soon: "bg-orange-50 text-orange-800",
  planned: "bg-blue-50 text-blue-800",
  empty: "text-gray-400",
};

export default async function IntegrationsPage(props: PageProps<"/integrations">) {
  await requireUser();
  const params = await props.searchParams;
  const today = startOfToday();

  const projects = await prisma.project.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  const asked = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const projectId = projects.some((project) => project.id === asked)
    ? (asked as string)
    : (projects[0]?.id ?? "");

  if (!projectId) {
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

  const [milestones, counterparties] = await Promise.all([
    prisma.counterpartyMilestone.findMany({
      where: { projectId },
      include: { counterparty: { select: { id: true, name: true, isInternal: true } } },
      orderBy: [{ counterparty: { name: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.counterparty.findMany({
      where: { isActive: true, isInternal: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = new Map<string, { name: string; items: typeof milestones }>();
  for (const milestone of milestones) {
    const row = rows.get(milestone.counterpartyId) ?? {
      name: milestone.counterparty.name,
      items: [],
    };
    row.items = [...row.items, milestone];
    rows.set(milestone.counterpartyId, row);
  }

  const free = counterparties.filter((item) => !rows.has(item.id));
  const total = rows.size;

  // Сводка: сколько организаций прошло каждый этап. Столбец графика и есть
  // единица отчётности по интеграциям.
  const passed = INTEGRATION_STAGES.map((stage) => ({
    stage,
    count: [...rows.values()].filter((row) =>
      row.items.some((item) => item.stage === stage.value && item.actualDate),
    ).length,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">График интеграций</h1>
        <p className="text-sm text-gray-500">
          Строка — организация, столбец — этап. В клетке план и факт: докуда дошли и где стоим
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <label className="field">
          Проект
          <select name="projectId" defaultValue={projectId} className="input w-64">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary">
          Показать
        </button>
      </form>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {passed.map(({ stage, count }) => (
          <div key={stage.value} className="card p-4">
            <p className="text-xs text-gray-500">{stage.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
              {count}
              <span className="ml-1 text-sm font-normal text-gray-400">из {total}</span>
            </p>
          </div>
        ))}
      </div>

      <IntegrationStartForm action={addIntegrationRow} projectId={projectId} counterparties={free} />

      {total === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          В графике пока нет ни одной организации. Добавьте первую формой выше.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            В графике {total} {plural(total, "организация", "организации", "организаций")}
          </p>

          <div className="space-y-2">
            {[...rows.entries()].map(([counterpartyId, row]) => {
              const progress = integrationProgress(row.items);
              const byStage = new Map(row.items.map((item) => [item.stage, item]));

              return (
                <section key={counterpartyId} className="card min-w-0 space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{row.name}</p>
                      <p className="text-sm text-gray-500">
                        Пройдено этапов: {progress} из {INTEGRATION_STAGES.length}
                      </p>
                    </div>
                    <form action={removeIntegrationRow}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="counterpartyId" value={counterpartyId} />
                      <ConfirmSubmit
                        className="btn-secondary"
                        question="Снять организацию с графика?"
                        confirmLabel="Да, снять"
                        pendingLabel="…"
                      >
                        Снять с графика
                      </ConfirmSubmit>
                    </form>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {INTEGRATION_STAGES.map((stage) => {
                      const milestone = byStage.get(stage.value);
                      const state = milestoneState(milestone, today);

                      return (
                        <div
                          key={stage.value}
                          className={`min-w-0 rounded-lg px-3 py-2 text-sm ${CELL[state]}`}
                        >
                          <p className="text-xs font-semibold">{stage.short}</p>
                          <p className="tabular-nums">
                            план {formatDate(milestone?.plannedDate)}
                          </p>
                          <p className="tabular-nums">факт {formatDate(milestone?.actualDate)}</p>
                          {milestone?.comment && (
                            <p className="mt-0.5 line-clamp-2 text-xs opacity-80">
                              {milestone.comment}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <IntegrationRowForm
                    action={saveIntegrationRow.bind(null, projectId, counterpartyId)}
                    milestones={row.items.map((item) => ({
                      stage: item.stage,
                      plannedDate: item.plannedDate,
                      actualDate: item.actualDate,
                      comment: item.comment,
                    }))}
                  />
                </section>
              );
            })}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <Legend className="bg-emerald-200" label="этап пройден" />
        <Legend className="bg-red-200" label="срок прошёл" />
        <Legend className="bg-orange-200" label="срок на этой неделе" />
        <Legend className="bg-blue-200" label="запланировано" />
        <Legend className="bg-gray-200" label="срок не задан" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded ${className}`} />
      {label}
    </span>
  );
}
