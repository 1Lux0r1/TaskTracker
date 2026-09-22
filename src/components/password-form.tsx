"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

export function PasswordForm({ action }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3">
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}
      <label className="field">
        Текущий пароль
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className="input max-w-xs"
        />
      </label>
      <label className="field">
        Новый пароль
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="input max-w-xs"
        />
      </label>
      <SubmitButton>Сменить пароль</SubmitButton>
    </form>
  );
}
