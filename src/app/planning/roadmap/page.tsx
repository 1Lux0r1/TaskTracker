import Link from "next/link";
import { setPlanDkStatus } from "@/app/actions/planning";
import { NoSystem } from "@/components/planning/no-system";
import { SystemSwitch } from "@/components/planning/system-switch";
import { SubmitButton } from "@/components/submit-button";
import { PLAN_DK_STATUSES, formatDate, planDkStatus, plural } from "@/lib/domain";
import { formatPlanNumber } from "@/lib/planning/cipher";
import { blockCipher, dkCipher, loadPlanTree, pickSystem } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

/** Дорожная карта: блоки «направление + часть», в каждом — карточки ДК. */
export default async function RoadmapPage(props: PageProps<"/planning/roadmap">) {
  const params = await props.searchParams;
  const { systems, system } = await pickSystem(params);
  if (!system) return <NoSystem />;

  const directions = await loadPlanTree(system.id);
  const blocks = directions.flatMap((direction) => direction.parts.map((part) => ({ direction, part })));

  return (
    <div>
      <SystemSwitch systems={systems} selected={system.id} basePath="/planning/roadmap" />

      {blocks.length === 0 && (
        <p className="card p-6 text-sm text-gray-500">
          Блоков пока нет: заведите направление и его части в справочниках модуля.
        </p>
      )}

      <div className="space-y-5">
        {blocks.map(({ direction, part }) => (
          <section key={part.id}>
            <div className="mb-2.5 flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[13px] font-semibold text-brand">{blockCipher(direction, part)}</span>
                <h2 className="font-display text-[17px] font-semibold text-gray-900">
                  {direction.name} · {part.name}
                </h2>
                <p className="text-[13px] text-gray-500">
                  {part.dks.length} {plural(part.dks.length, "ДК", "ДК", "ДК")} ·{" "}
                  {direction.oftApprovedAt
                    ? `ОФТ согласован ${formatDate(direction.oftApprovedAt)}`
                    : "ОФТ не согласован"}
                </p>
              </div>
              <Link href={`/planning/dk/new?part=${part.id}`} className="btn-secondary">
                Новый ДК
              </Link>
            </div>

            {part.dks.length === 0 ? (
              <p className="card p-4 text-sm text-gray-500">В блоке пока нет ДК.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {part.dks.map((dk) => {
                  const status = planDkStatus(dk.status);
                  const modules = [...new Set(dk.tasks.flatMap((task) => (task.module ? [task.module.number] : [])))].sort(
                    (a, b) => a - b,
                  );
                  const stages = [...new Set(dk.tasks.filter((task) => !task.module).map((task) => task.stage.code))];
                  // Производство начинается, когда согласованы ОФТ направления и ТР ДК.
                  const readyForProduction = Boolean(direction.oftApprovedAt && dk.trApprovedAt);
                  return (
                    <article key={dk.id} className="card p-4">
                      <div className="flex items-start gap-2">
                        <Link href={`/planning/dk/${dk.id}`} className="min-w-0 flex-1 hover:underline">
                          <span className="font-mono text-[12.5px] text-gray-500">{dkCipher(direction, part, dk)}</span>
                          <h3 className="font-display text-[15.5px] leading-snug font-semibold text-gray-900">
                            {dk.name}
                          </h3>
                        </Link>
                        <span className={`badge ${status.tone}`}>{status.label}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-gray-500">
                        Статус с {formatDate(dk.statusSince)} · ТР{" "}
                        {dk.trApprovedAt ? `согласован ${formatDate(dk.trApprovedAt)}` : "не согласован"}
                        {readyForProduction ? " · можно в производство" : ""}
                      </p>
                      {dk.note && <p className="mt-2 line-clamp-2 text-sm text-gray-700">{dk.note}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {stages.map((code) => (
                          <span key={code} className="badge bg-purple-50 text-purple-600">
                            {code}
                          </span>
                        ))}
                        {modules.map((number) => (
                          <span key={number} className="badge bg-gray-100 font-mono text-gray-700">
                            МС {formatPlanNumber(number)}
                          </span>
                        ))}
                        <span className="ml-auto text-[12.5px] text-gray-500">
                          {dk.tasks.length} {plural(dk.tasks.length, "задача", "задачи", "задач")}
                        </span>
                      </div>
                      <form action={setPlanDkStatus} className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
                        <input type="hidden" name="id" value={dk.id} />
                        <select name="status" defaultValue={dk.status} aria-label="Статус ДК" className="input mt-0 flex-1 py-1.5">
                          {PLAN_DK_STATUSES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <SubmitButton className="btn-secondary px-2.5 py-1.5 text-[13px]" pendingLabel="…">
                          Сменить
                        </SubmitButton>
                      </form>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
