"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  next?: string;
};

export function LoginForm({ action, next }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="field">
        Рабочая почта
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="username"
          className="input"
          placeholder="ivanov@example.com"
        />
      </label>
      <label className="field">
        Пароль
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </label>
      <SubmitButton className="btn-primary w-full" pendingLabel="Входим…">
        Войти
      </SubmitButton>
    </form>
  );
}
