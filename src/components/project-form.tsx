"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES, toDateInputValue } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type ProjectFormValues = {
  code: string;
  name: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
  ownerId: string | null;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  members: { id: string; fullName: string }[];
  defaults?: ProjectFormValues;
  submitLabel: string;
};

export function ProjectForm({ action, members, defaults, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <KeepFormValues state={state} />
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          Код проекта
          <input
            name="code"
            required
            defaultValue={defaults?.code}
            placeholder="ERP"
            className="input uppercase"
          />
        </label>
        <label className="field sm:col-span-2">
          Название
          <input name="name" required defaultValue={defaults?.name} className="input" />
        </label>
      </div>

      <label className="field">
        Описание
        <textarea
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ""}
          className="input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="field">
          Статус
          <select name="status" defaultValue={defaults?.status ?? "ACTIVE"} className="input">
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Начало
          <input
            type="date"
            name="startDate"
            defaultValue={toDateInputValue(defaults?.startDate)}
            className="input"
          />
        </label>
        <label className="field">
          Срок
          <input
            type="date"
            name="dueDate"
            defaultValue={toDateInputValue(defaults?.dueDate)}
            className="input"
          />
        </label>
        <label className="field">
          Руководитель
          <select name="ownerId" defaultValue={defaults?.ownerId ?? ""} className="input">
            <option value="">— не назначен —</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
