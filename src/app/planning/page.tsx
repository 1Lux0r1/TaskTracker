import Link from "next/link";
import { NoSystem } from "@/components/planning/no-system";
import { SystemSwitch } from "@/components/planning/system-switch";
import { formatDate, planPriorityLabel, plural } from "@/lib/domain";
import { blockCipher, directionCipher, loadPlanTree, pickSystem } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<string, { badge: string; accent: string }> = {
  MAIN: { badge: "bg-brand-soft text-brand", accent: "--color-brand" },
  SUPPORT: { badge: "bg-green-50 text-green-700", accent: "--color-green-600" },
  DEFERRED: { badge: "bg-gray-100 text-gray-600", accent: "--color-gray-400" },
};

/** Направления — карточки верхнего уровня: решение руководства и ход по нему. */
export default async function DirectionsPage(props: PageProps<"/planning">) {
  const params = await props.searchParams;
  const { systems, system } = await pickSystem(params);
  if (!system) return <NoSystem />;

  const directions = await loadPlanTree(system.id);

  return (
    <div>
      <SystemSwitch systems={systems} selected={system.id} basePath="/planning" />
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <b className="font-mono text-gray-900">{system.code}</b> · {system.name} ·{" "}
          {directions.length} {plural(directions.length, "направление", "направления", "направлений")}
        </p>
        <Link href={`/planning/directions/new?system=${system.id}`} className="btn-primary">
          Новое направление
        </Link>
      </div>

      {directions.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          Направлений пока нет. Направление — решение руководства: цель, срок и приоритет.
        </p>
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {directions.map((direction) => {
            const dks = direction.parts.reduce((sum, part) => sum + part.dks.length, 0);
            const tasks = direction.parts.reduce(
              (sum, part) => sum + part.dks.reduce((n, dk) => n + dk.tasks.length, 0),
              0,
            );
            const tone = PRIORITY_TONE[direction.priority] ?? PRIORITY_TONE.MAIN;
            return (
              <Link
                key={direction.id}
                href={`/planning/directions/${direction.id}`}
                className="card card-accent block p-4.5 hover:border-gray-300"
                style={{ ["--accent" as string]: `var(${tone.accent})` }}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[12.5px] text-gray-500">{directionCipher(direction)}</span>
                    <h2 className="font-display text-[17px] leading-snug font-semibold text-gray-900">
                      {direction.name}
                    </h2>
                  </div>
                  <span className={`badge ${tone.badge}`}>{planPriorityLabel(direction.priority)}</span>
                </div>

                {direction.goal && <p className="mt-2 line-clamp-3 text-sm text-gray-700">{direction.goal}</p>}

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  <Fact label="Срок" value={formatDate(direction.deadline)} />
                  <Fact
                    label="ОФТ"
                    value={
                      direction.oftApprovedAt ? (
                        <span className="text-green-700">согласован {formatDate(direction.oftApprovedAt)}</span>
                      ) : (
                        <span className="text-amber-700">не согласован</span>
                      )
                    }
                  />
                  <Fact label="Решение" value={formatDate(direction.decisionDate)} />
                  <Fact label="Основание" value={direction.decisionBasis ?? "—"} />
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
                  <Counter n={direction.parts.length} words={["блок", "блока", "блоков"]} />
                  <Counter n={dks} words={["ДК", "ДК", "ДК"]} />
                  <Counter n={tasks} words={["задача", "задачи", "задач"]} />
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {direction.parts.map((part) => (
                      <span key={part.id} className="badge bg-gray-100 font-mono text-gray-600" title={part.name}>
                        {blockCipher(direction, part).split(".").at(-1)} · {part.dks.length}
                      </span>
                    ))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] tracking-wide text-gray-500 uppercase">{label}</span>
      <span className="block truncate text-gray-800">{value}</span>
    </div>
  );
}

function Counter({ n, words }: { n: number; words: [string, string, string] }) {
  return (
    <span className="text-[13px] text-gray-600">
      <b className="font-display text-base text-gray-900 tabular-nums">{n}</b> {plural(n, ...words)}
    </span>
  );
}
