"use client";

import { useActionState, useState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import { INTEGRATION_STAGES, toDateInputValue } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type MilestoneValues = {
  stage: string;
  plannedDate: Date | null;
  actualDate: Date | null;
  comment: string | null;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  milestones: MilestoneValues[];
};

/**
 * Правка строки графика: все пять этапов сразу, как в исходной таблице, где
 * строку организации заполняли в один заход.
 */
export function IntegrationRowForm({ action, milestones }: Props) {
  const [state, formAction] = useActionState(action, null);
  const [open, setOpen] = useState(false);

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) setOpen(false);
  }

  const byStage = new Map(milestones.map((item) => [item.stage, item]));

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Заполнить даты
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
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {INTEGRATION_STAGES.map((stage) => {
          const milestone = byStage.get(stage.value);
          return (
            <div key={stage.value} className="space-y-1 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700">{stage.label}</p>
              <label className="field text-xs">
                План
                <input
                  type="date"
                  name={`planned_${stage.value}`}
                  defaultValue={toDateInputValue(milestone?.plannedDate)}
                  className="input"
                />
              </label>
              <label className="field text-xs">
                Факт
                <input
                  type="date"
                  name={`actual_${stage.value}`}
                  defaultValue={toDateInputValue(milestone?.actualDate)}
                  className="input"
                />
              </label>
              <label className="field text-xs">
                Примечание
                <input
                  name={`comment_${stage.value}`}
                  defaultValue={milestone?.comment ?? ""}
                  className="input"
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton>Сохранить строку</SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Отмена
        </button>
      </div>
    </form>
  );
}
