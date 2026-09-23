"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  member: {
    id: string;
    fullName: string;
    displayName: string | null;
    position: string | null;
    email: string | null;
  };
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

/** Правка карточки сотрудника прямо в строке списка. */
export function MemberEditForm({ member, action }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  // После удачного сохранения строка возвращается к обычному виду: иначе
  // пользователь остаётся в полях ввода и не видит, что получилось. Сравнение
  // с прошлым ответом — чтобы закрыть форму один раз, а не на каждый рендер.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok && open) setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900">{member.fullName}</span>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Изменить
        </button>
        {state?.ok && state.message && (
          <span className="text-xs text-emerald-600">{state.message}</span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="memberId" value={member.id} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="fullName"
          required
          maxLength={200}
          defaultValue={member.fullName}
          className="input w-52"
          placeholder="ФИО"
        />
        <input
          name="displayName"
          defaultValue={member.displayName ?? ""}
          className="input w-36"
          placeholder="Имя для обращения"
        />
        <input
          name="position"
          defaultValue={member.position ?? ""}
          className="input w-44"
          placeholder="Должность"
        />
        <input
          type="email"
          name="email"
          defaultValue={member.email ?? ""}
          className="input w-56"
          placeholder="Рабочая почта"
        />
        <SubmitButton className="btn-primary" pendingLabel="…">
          Сохранить
        </SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Отмена
        </button>
      </div>
      {state && !state.ok && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
