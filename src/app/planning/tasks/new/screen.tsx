import { createPlanTask } from "@/app/actions/planning";
import { type NewScreenProps } from "@/components/overlay-panel";
import { CipherCalculator } from "@/components/planning/cipher-calculator";
import { NoSystem } from "@/components/planning/no-system";
import { prisma } from "@/lib/db";
import { loadCalculatorData, param, pickSystem } from "@/lib/planning/queries";

/** Новая задача плана — тот же калькулятор шифра с выбранным ДК. */
export async function NewPlanTaskScreen({ searchParams }: NewScreenProps) {
  const params = await searchParams;
  const dkId = param(params, "dk");
  const dk = dkId
    ? await prisma.planDk.findUnique({
        where: { id: dkId },
        select: { part: { select: { direction: { select: { systemId: true } } } } },
      })
    : null;
  const { system } = await pickSystem(dk ? { system: dk.part.direction.systemId } : params);
  if (!system) return <NoSystem />;

  const data = await loadCalculatorData(system);
  return (
    <CipherCalculator data={data} defaults={{ dkId }} action={createPlanTask} submitLabel="Добавить в план" />
  );
}
