"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import { SIGNATURE_STATUS_LABELS, SIGNATURE_STATUSES } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  documentId: string;
  counterparties: { id: string; name: string }[];
};

/** Добавление стороны подписания к документу. */
export function SignatureForm({ action, documentId, counterparties }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3 rounded-lg bg-gray-50 p-4">
      <KeepFormValues state={state} />
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <input type="hidden" name="documentId" value={documentId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="field">
          Сторона
          <input
            name="party"
            required
            placeholder="Например: ДЖКХ"
            className="input w-52"
          />
        </label>
        <label className="field">
          Организация из справочника
          <select name="counterpartyId" defaultValue="" className="input w-56">
            <option value="">— не связывать —</option>
            {counterparties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Статус
          <select name="status" defaultValue="PENDING" className="input w-40">
            {SIGNATURE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {SIGNATURE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton className="btn-secondary">Добавить сторону</SubmitButton>
      </div>
    </form>
  );
}
