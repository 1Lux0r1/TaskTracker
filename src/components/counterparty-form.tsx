"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

export function CounterpartyForm({ action }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3 p-4">
      {state && !state.ok && (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}
      <label className="field">
        Название организации
        <input name="name" required className="input w-80" />
      </label>
      <label className="field">
        Сокращение
        <input name="shortName" placeholder="Например: ДЖКХ" className="input w-48" />
      </label>
      <SubmitButton>Добавить</SubmitButton>
    </form>
  );
}
