import Link from "next/link";
import { createPlanDk } from "@/app/actions/planning";
import { type NewScreenProps } from "@/components/overlay-panel";
import { ActionForm } from "@/components/planning/action-form";
import { DkFields } from "@/components/planning/dk-fields";
import { NoSystem } from "@/components/planning/no-system";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { formatPlanNumber } from "@/lib/planning/cipher";
import { param, pickSystem } from "@/lib/planning/queries";

export async function NewDkScreen({ searchParams, inPanel }: NewScreenProps) {
  const params = await searchParams;
  const askedPart = param(params, "part");
  const partSystem = askedPart
    ? await prisma.planDirectionPart.findUnique({
        where: { id: askedPart },
        select: { direction: { select: { systemId: true } } },
      })
    : null;
  const { system } = await pickSystem(
    partSystem ? { system: partSystem.direction.systemId } : params,
  );
  if (!system) return <NoSystem />;

  const [parts, subsystems] = await Promise.all([
    prisma.planDirectionPart.findMany({
      where: { direction: { systemId: system.id } },
      orderBy: [{ direction: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        direction: { select: { code: true, name: true } },
        dks: { orderBy: { number: "desc" }, take: 1, select: { number: true } },
      },
    }),
    prisma.planSubsystem.findMany({
      where: { systemId: system.id },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  return (
    <div className={inPanel ? "space-y-4" : "max-w-3xl space-y-4"}>
      {!inPanel && (
        <Link href="/planning/roadmap" className="text-sm text-gray-500 hover:underline">
          ← Дорожная карта
        </Link>
      )}
      {parts.length === 0 ? (
        <p className="card p-5 text-sm text-gray-500">
          Сначала заведите направление и его часть: ДК ведётся внутри блока.
        </p>
      ) : (
        <ActionForm action={createPlanDk} className={inPanel ? "space-y-3" : "card space-y-3 p-5"}>
          <label className="field">
            Блок: направление и часть
            <select name="partId" required defaultValue={askedPart ?? ""} className="input">
              <option value="" disabled>
                Выберите блок
              </option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {system.code}.{part.direction.code}.{part.code} · {part.direction.name} · {part.name} — следующий
                  ДК {formatPlanNumber((part.dks[0]?.number ?? 0) + 1)}
                </option>
              ))}
            </select>
          </label>
          <DkFields
            subsystems={subsystems}
            defaults={{
              name: "",
              subsystemId: null,
              status: "PRESTUDY",
              statusSince: null,
              note: null,
              trApprovedAt: null,
            }}
          />
          <p className="text-[13px] text-gray-500">Номер ДК выдаётся сквозным внутри блока.</p>
          <SubmitButton>Создать ДК</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
