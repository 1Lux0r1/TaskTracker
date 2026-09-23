"use client";

import { useActionState, useState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

export type OrgContactValues = {
  id: string;
  counterpartyId: string;
  fullName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  comment: string | null;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  counterparties: { id: string; name: string }[];
  /** Есть — правим запись, нет — заводим новую. */
  contact?: OrgContactValues;
  submitLabel: string;
};

/**
 * Карточка представителя организации. Правка идёт прямо в списке: запись
 * короткая, и открывать ради неё отдельную страницу незачем.
 */
export function OrgContactForm({ action, counterparties, contact, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, null);
  const [open, setOpen] = useState(!contact);

  // После удачного сохранения форма правки закрывается, чтобы человек увидел
  // результат, а не остался в полях ввода.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok && contact) setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
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
    <form action={formAction} className="space-y-3">
      <KeepFormValues state={state} />
      {contact && <input type="hidden" name="contactId" value={contact.id} />}

      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && !contact && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="field">
          Организация
          <select
            name="counterpartyId"
            required
            defaultValue={contact?.counterpartyId ?? ""}
            className="input"
          >
            <option value="">— выберите —</option>
            {counterparties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          ФИО
          <input
            name="fullName"
            required
            maxLength={200}
            defaultValue={contact?.fullName ?? ""}
            className="input"
          />
        </label>
        <label className="field">
          Должность
          <input name="position" defaultValue={contact?.position ?? ""} className="input" />
        </label>
        <label className="field">
          Телефон
          <input name="phone" defaultValue={contact?.phone ?? ""} className="input" />
        </label>
        <label className="field">
          Почта
          <input name="email" defaultValue={contact?.email ?? ""} className="input" />
        </label>
        <label className="field">
          За что отвечает
          <input
            name="comment"
            defaultValue={contact?.comment ?? ""}
            placeholder="Подписание НДА, сверка данных"
            className="input"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        {contact && (
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}
