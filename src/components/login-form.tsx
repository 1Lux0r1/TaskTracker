"use client";

import { useActionState } from "react";
import type { LoginState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  action: (state: LoginState | null, formData: FormData) => Promise<LoginState>;
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
          defaultValue={state?.email ?? ""}
          key={state?.email ?? ""}
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
