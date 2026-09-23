"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  value: string | null;
  placeholder: string;
};

/** Как обращаться к человеку на «Сегодня»: одно поле, по желанию. */
export function DisplayNameForm({ action, value, placeholder }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="field">
        Имя для обращения
        <input
          name="displayName"
          defaultValue={value ?? ""}
          placeholder={placeholder}
          maxLength={60}
          className="input w-56"
        />
      </label>
      <SubmitButton className="btn-secondary">Сохранить</SubmitButton>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
      {state?.ok && state.message && (
        <p className="w-full text-sm text-emerald-700">{state.message}</p>
      )}
    </form>
  );
}
