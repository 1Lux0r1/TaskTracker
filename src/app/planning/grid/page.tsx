import Link from "next/link";
import { NoSystem } from "@/components/planning/no-system";
import { SystemSwitch } from "@/components/planning/system-switch";
import { prisma } from "@/lib/db";
import { msLabel } from "@/lib/planning/cipher";
import {
  type GridCounts,
  moduleTaskCounts,
  sharedModules,
  subsystemDkCounts,
  subsystemTaskCounts,
} from "@/lib/planning/grid";
import { blockKey, loadPlanTree, param, pickSystem } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

/**
 * Решётка: где пересекаются блоки. Подсистемы × блоки показывают, какие
 * части системы затрагивает каждый блок; МС × блоки — какие МС делят
 * несколько блоков (такие подсвечены).
 */
export default async function GridPage(props: PageProps<"/planning/grid">) {
  const params = await props.searchParams;
  const { systems, system } = await pickSystem(params);
  if (!system) return <NoSystem />;

  const by = param(params, "by") === "dk" ? "dk" : "tasks";
  const [directions, subsystems, modules] = await Promise.all([
    loadPlanTree(system.id),
    prisma.planSubsystem.findMany({ where: { systemId: system.id }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.planModule.findMany({
      where: { systemId: system.id },
      orderBy: { number: "asc" },
      include: { subsystem: { select: { code: true } } },
    }),
  ]);

  const allBlocks = directions.flatMap((direction) =>
    direction.parts.map((part) => ({ key: blockKey(direction, part), title: `${direction.name} · ${part.name}`, part })),
  );
  // Колонки — только блоки с ДК: в книге десятки разделов ОФТ ещё без
  // пунктов, и пустые колонки растягивали решётку на несколько экранов.
  const blocks = allBlocks.filter((block) => block.part.dks.length > 0);
  const dks = blocks.flatMap((block) =>
    block.part.dks.map((dk) => ({ id: dk.id, blockKey: block.key, subsystemId: dk.subsystemId })),
  );
  const tasks = blocks.flatMap((block) =>
    block.part.dks.flatMap((dk) =>
      dk.tasks.map((task) => ({
        dkId: dk.id,
        blockKey: block.key,
        moduleId: task.moduleId,
        moduleSubsystemId: task.module?.subsystem.id ?? null,
      })),
    ),
  );

  const subsystemCounts = by === "dk" ? subsystemDkCounts(dks, tasks) : subsystemTaskCounts(dks, tasks);
  const moduleCounts = moduleTaskCounts(tasks);
  const shared = sharedModules(moduleCounts);
  const usedModules = modules.filter((item) => moduleCounts.has(item.id));

  if (allBlocks.length === 0) {
    return <p className="card p-6 text-sm text-gray-500">Блоков пока нет: решётке не из чего строиться.</p>;
  }

  return (
    <div className="space-y-3.5">
      <SystemSwitch systems={systems} selected={system.id} basePath="/planning/grid" />

      <section className="card card-accent overflow-hidden">
        <div className="flex flex-wrap items-start gap-3 px-4.5 pt-4.5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15.5px] font-semibold text-gray-900">Подсистемы × блоки</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {by === "dk"
                ? "Число ДК блока, которые задевают подсистему: у ДК или через МС задач"
                : "Число задач: по МС — подсистема МС, по ДК — подсистема ДК"}
              {blocks.length < allBlocks.length ? ` · блоки с ДК: ${blocks.length} из ${allBlocks.length}` : ""}
            </p>
          </div>
          <div className="seg">
            <Link href="/planning/grid" aria-current={by === "tasks" ? "page" : undefined} className="seg-btn">
              Задачи
            </Link>
            <Link href="/planning/grid?by=dk" aria-current={by === "dk" ? "page" : undefined} className="seg-btn">
              ДК
            </Link>
          </div>
        </div>
        <Matrix
          blocks={blocks}
          rows={subsystems.map((item) => ({ id: item.id, label: item.code, note: item.name }))}
          counts={subsystemCounts}
        />
      </section>

      <section className="card card-accent overflow-hidden" style={{ ["--accent" as string]: "var(--color-copper)" }}>
        <div className="px-4.5 pt-4.5 pb-3">
          <h2 className="font-display text-[15.5px] font-semibold text-gray-900">МС × блоки</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Число задач. Показаны МС, по которым есть задачи ({usedModules.length} из {modules.length}); МС в
            двух и более блоках подсвечены — {shared.size}.
          </p>
        </div>
        {usedModules.length === 0 ? (
          <p className="px-4.5 pb-4.5 text-sm text-gray-500">Задач по МС пока нет.</p>
        ) : (
          <Matrix
            blocks={blocks}
            rows={usedModules.map((item) => ({
              id: item.id,
              label: msLabel(item),
              note: `№ ${item.number} · ${item.name}`,
              hot: shared.has(item.id),
            }))}
            counts={moduleCounts}
          />
        )}
      </section>
    </div>
  );
}

type MatrixRow = { id: string; label: string; note: string; hot?: boolean };

function Matrix({
  blocks,
  rows,
  counts,
}: {
  blocks: { key: string; title: string }[];
  rows: MatrixRow[];
  counts: GridCounts;
}) {
  const max = Math.max(1, ...[...counts.values()].flatMap((line) => [...line.values()]));
  const columns = `minmax(220px, 320px) repeat(${blocks.length}, 88px)`;

  return (
    <div className="overflow-x-auto px-3 pb-3">
      <div className="grid gap-1" style={{ gridTemplateColumns: columns, minWidth: 260 + blocks.length * 80 }}>
        <span />
        {blocks.map((block) => (
          <span key={block.key} title={block.title} className="truncate px-1 pb-1 text-center font-mono text-[12px] font-semibold text-gray-700">
            {block.key}
          </span>
        ))}
        {rows.map((row) => (
          <div key={row.id} className="contents">
            <span
              className={`flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 ${row.hot ? "bg-amber-50" : ""}`}
            >
              <b className="font-mono text-[13px] text-gray-900">{row.label}</b>
              <span className="truncate text-[12.5px] text-gray-500">{row.note}</span>
              {row.hot && <span className="badge ml-auto bg-amber-100 text-amber-700">в {counts.get(row.id)?.size} блоках</span>}
            </span>
            {blocks.map((block) => {
              const value = counts.get(row.id)?.get(block.key) ?? 0;
              return (
                <span
                  key={block.key}
                  className={`grid place-items-center rounded-md py-1.5 text-[13px] tabular-nums ${
                    value === 0
                      ? "text-gray-300"
                      : row.hot
                        ? "bg-amber-500 font-semibold text-white"
                        : "font-semibold text-white"
                  }`}
                  style={
                    value > 0 && !row.hot
                      ? { background: `color-mix(in srgb, var(--color-brand) ${35 + Math.round((value / max) * 65)}%, transparent)` }
                      : undefined
                  }
                >
                  {value === 0 ? "·" : value}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
