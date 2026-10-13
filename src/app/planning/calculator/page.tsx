import { createPlanTask } from "@/app/actions/planning";
import { CipherCalculator } from "@/components/planning/cipher-calculator";
import { NoSystem } from "@/components/planning/no-system";
import { SystemSwitch } from "@/components/planning/system-switch";
import { loadCalculatorData, param, pickSystem } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

/**
 * Калькулятор шифра: шифр складывается из выбранных значений, рядом —
 * готов ли он или уже есть в плане. Готовый шифр сразу добавляется в план.
 */
export default async function CalculatorPage(props: PageProps<"/planning/calculator">) {
  const params = await props.searchParams;
  const { systems, system } = await pickSystem(params);
  if (!system) return <NoSystem />;

  const data = await loadCalculatorData(system);
  return (
    <div>
      <SystemSwitch systems={systems} selected={system.id} basePath="/planning/calculator" />
      <CipherCalculator
        data={data}
        defaults={{ dkId: param(params, "dk") }}
        action={createPlanTask}
        submitLabel="Добавить в план"
      />
    </div>
  );
}
