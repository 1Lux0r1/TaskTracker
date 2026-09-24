"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import { REFERENCE_SECTIONS } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type ReferenceFormValues = {
  projectId: string | null;
  section: string;
  title: string;
  content: string;
  authorId: string | null;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projects: { id: string; code: string; name: string }[];
  members: { id: string; fullName: string }[];
  defaults?: ReferenceFormValues;
  submitLabel: string;
};

/** Страница справочника: раздел, заголовок, содержание и кто её ведёт. */
export function ReferenceForm({ action, projects, members, defaults, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <KeepFormValues state={state} />
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          Раздел
          <select name="section" defaultValue={defaults?.section ?? "OTHER"} className="input">
            {REFERENCE_SECTIONS.map((section) => (
              <option key={section.value} value={section.value}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Проект
          <select name="projectId" defaultValue={defaults?.projectId ?? ""} className="input">
            <option value="">Общая страница</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Кто ведёт
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
        Заголовок
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={defaults?.title ?? ""}
          className="input"
        />
      </label>

      <label className="field">
        Содержание
        <textarea
          name="content"
          required
          rows={14}
          defaultValue={defaults?.content ?? ""}
          placeholder="Текст страницы. Пустая строка разделяет абзацы."
          className="input font-mono text-sm"
        />
      </label>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
