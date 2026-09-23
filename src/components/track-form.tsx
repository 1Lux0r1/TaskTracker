"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import { TRACK_COLORS } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projectId: string;
};

/** Заведение трека в справочнике проекта. */
export function TrackForm({ action, projectId }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3 p-4">
      <KeepFormValues state={state} />
      <input type="hidden" name="projectId" value={projectId} />
      {state && !state.ok && (
        <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}
      <label className="field">
        Название трека
        <input name="name" required maxLength={80} className="input w-64" placeholder="Например, Закупки" />
      </label>
      <label className="field">
        Цвет
        <select name="color" className="input w-44" defaultValue="blue">
          {TRACK_COLORS.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton>Добавить трек</SubmitButton>
    </form>
  );
}
