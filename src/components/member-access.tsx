"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  memberId: string;
  hasPassword: boolean;
  hasEmail: boolean;
  setPassword: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

/** Управление доступом одного сотрудника: пароль заводит администратор. */
export function MemberAccess({ memberId, hasPassword, hasEmail, setPassword }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setPassword, null);

  if (!hasEmail) {
    return <span className="text-xs text-gray-400">Нужна почта</span>;
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        {hasPassword ? "Сменить пароль" : "Дать доступ"}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex items-center gap-2">
        <input
          type="text"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Новый пароль"
          className="input w-40"
        />
        <SubmitButton className="btn-primary" pendingLabel="…">
          Сохранить
        </SubmitButton>
      </div>
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
    </form>
  );
}
