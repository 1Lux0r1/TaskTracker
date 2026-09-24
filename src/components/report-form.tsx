"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import { toDateInputValue } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type ReportFormValues = {
  projectId: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  releaseInfo: string | null;
  done: string | null;
  planned: string | null;
  blockers: string | null;
  solutions: string | null;
  authorId: string | null;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projects: { id: string; code: string; name: string }[];
  members: { id: string; fullName: string }[];
  defaults?: ReportFormValues;
  /** Отправленный отчёт заморожен: править можно только черновик. */
  readOnly?: boolean;
  submitLabel: string;
};

export function ReportForm({
  action,
  projects,
  members,
  defaults,
  readOnly = false,
  submitLabel,
}: Props) {
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

      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="field">
            Проект
            <select
              name="projectId"
              defaultValue={defaults?.projectId ?? projects[0]?.id}
              required
              className="input"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Начало периода
            <input
              type="date"
              name="periodStart"
              required
              defaultValue={toDateInputValue(defaults?.periodStart)}
              className="input"
            />
          </label>
          <label className="field">
            Конец периода
            <input
              type="date"
              name="periodEnd"
              required
              defaultValue={toDateInputValue(defaults?.periodEnd)}
              className="input"
            />
          </label>
          <label className="field">
            Автор
            <select name="authorId" defaultValue={defaults?.authorId ?? ""} className="input">
              <option value="">— не указан —</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          Релиз: состав и дата
          <textarea
            name="releaseInfo"
            rows={3}
            defaultValue={defaults?.releaseInfo ?? ""}
            className="input"
          />
        </label>

        <label className="field">
          Выполненные работы за период
          <textarea name="done" rows={8} defaultValue={defaults?.done ?? ""} className="input" />
        </label>

        <label className="field">
          Запланированные работы на следующий период
          <textarea
            name="planned"
            rows={8}
            defaultValue={defaults?.planned ?? ""}
            className="input"
          />
        </label>

        <label className="field">
          Текущие блокеры
          <textarea
            name="blockers"
            rows={5}
            defaultValue={defaults?.blockers ?? ""}
            className="input"
          />
        </label>

        <label className="field">
          Предлагаемые решения
          <textarea
            name="solutions"
            rows={4}
            defaultValue={defaults?.solutions ?? ""}
            className="input"
          />
        </label>
      </fieldset>

      {!readOnly && <SubmitButton>{submitLabel}</SubmitButton>}
    </form>
  );
}
