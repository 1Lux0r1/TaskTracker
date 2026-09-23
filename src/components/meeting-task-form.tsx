"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  meetingId: string;
  members: { id: string; fullName: string }[];
};

/**
 * Заведение задачи прямо из карточки встречи: формулировка, ответственный и
 * срок. Остальное задача берёт от встречи — проект, трек и связь с протоколом.
 */
export function MeetingTaskForm({ action, meetingId, members }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3 border-t border-gray-100 pt-3">
      <input type="hidden" name="meetingId" value={meetingId} />

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="field sm:col-span-2">
          Что нужно сделать
          <input
            name="title"
            required
            placeholder="Например: подготовить проект акта"
            className="input"
          />
        </label>
        <label className="field">
          Ответственный
          <select name="assigneeId" defaultValue="" className="input">
            <option value="">— не назначен —</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Срок
          <input type="date" name="dueDate" className="input" />
        </label>
      </div>

      {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && state.message && (
        <p className="text-sm text-emerald-700">{state.message}</p>
      )}

      <SubmitButton className="btn-secondary" pendingLabel="Заводим…">
        Создать задачу
      </SubmitButton>
    </form>
  );
}
