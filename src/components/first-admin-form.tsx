"use client";

import { useActionState } from "react";
import type { SetupState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  action: (state: SetupState, formData: FormData) => Promise<SetupState>;
};

/** Первый запуск: заводим администратора прямо на экране входа. */
export function FirstAdminForm({ action }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1 text-sm text-gray-600">
        <p className="font-medium text-gray-900">Первый запуск</p>
        <p>
          Заведите администратора. Он войдёт сразу, а остальных сотрудников добавит в
          справочнике «Сотрудники».
        </p>
      </div>
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="field">
        Имя и фамилия
        <input
          name="fullName"
          required
          autoFocus
          autoComplete="name"
          className="input"
          placeholder="Иванов Иван"
          defaultValue={state?.fullName ?? ""}
        />
      </label>
      <label className="field">
        Рабочая почта
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          className="input"
          placeholder="ivanov@example.com"
          defaultValue={state?.email ?? ""}
        />
      </label>
      <label className="field">
        Пароль
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </label>
      <label className="field">
        Пароль ещё раз
        <input
          type="password"
          name="passwordRepeat"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </label>
      <SubmitButton className="btn-primary w-full" pendingLabel="Заводим…">
        Завести и войти
      </SubmitButton>
    </form>
  );
}
