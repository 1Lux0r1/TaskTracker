"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projectId: string;
  counterparties: { id: string; name: string }[];
};

/**
 * Организация попадает в график пустой строкой: сначала видно, что она в
 * работе, а даты проставляются по мере движения.
 */
export function IntegrationStartForm({ action, projectId, counterparties }: Props) {
  const [state, formAction] = useActionState(action, null);

  if (counterparties.length === 0) {
    return (
      <p className="card p-4 text-sm text-gray-500">
        Все организации справочника уже в графике. Новую можно завести в справочнике организаций.
      </p>
    );
  }

  return (
    <form action={formAction} className="card space-y-2 p-4">
      <KeepFormValues state={state} />
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="field min-w-0 flex-1">
          Добавить организацию в график
          <select name="counterpartyId" defaultValue="" className="input">
            <option value="">Выберите организацию</option>
            {counterparties.map((counterparty) => (
              <option key={counterparty.id} value={counterparty.id}>
                {counterparty.name}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton pendingLabel="Добавляем…">Добавить</SubmitButton>
      </div>
    </form>
  );
}
