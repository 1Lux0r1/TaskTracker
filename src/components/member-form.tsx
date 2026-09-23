"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

export function MemberForm({ action }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3 p-4">
      <KeepFormValues state={state} />
      {state && !state.ok && (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}
      <label className="field">
        ФИО
        <input name="fullName" required className="input w-64" />
      </label>
      <label className="field">
        Имя для обращения
        <input name="displayName" placeholder="Алексей" className="input w-44" />
      </label>
      <label className="field">
        Должность
        <input name="position" className="input w-56" />
      </label>
      <label className="field">
        Email
        <input type="email" name="email" className="input w-64" />
      </label>
      <SubmitButton>Добавить</SubmitButton>
    </form>
  );
}
