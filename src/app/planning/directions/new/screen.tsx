import Link from "next/link";
import { createPlanDirection } from "@/app/actions/planning";
import { type NewScreenProps } from "@/components/overlay-panel";
import { ActionForm } from "@/components/planning/action-form";
import { DirectionFields } from "@/components/planning/direction-fields";
import { NoSystem } from "@/components/planning/no-system";
import { SubmitButton } from "@/components/submit-button";
import { pickSystem } from "@/lib/planning/queries";

export async function NewDirectionScreen({ searchParams, inPanel }: NewScreenProps) {
  const params = await searchParams;
  const { system } = await pickSystem(params);
  if (!system) return <NoSystem />;

  return (
    <div className={inPanel ? "space-y-4" : "max-w-3xl space-y-4"}>
      {!inPanel && (
        <Link href="/planning" className="text-sm text-gray-500 hover:underline">
          ← Направления
        </Link>
      )}
      <ActionForm action={createPlanDirection} className={inPanel ? "" : "card p-5"}>
        <p className="mb-3 text-sm text-gray-500">
          Система <b className="font-mono text-gray-900">{system.code}</b>. Код направления станет вторым
          сегментом шифра и кодом ОФТ.
        </p>
        <DirectionFields
          defaults={{
            systemId: system.id,
            code: "",
            name: "",
            goal: null,
            deadline: null,
            priority: "MAIN",
            decisionDate: null,
            decisionBasis: null,
            oftApprovedAt: null,
          }}
        />
        <div className="mt-4">
          <SubmitButton>Создать направление</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
