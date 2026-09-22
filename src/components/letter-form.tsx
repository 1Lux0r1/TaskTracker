"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  LETTER_DIRECTION_LABELS,
  LETTER_DIRECTIONS,
  LETTER_STATUS_LABELS,
  LETTER_STATUSES,
  toDateInputValue,
} from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type LetterFormValues = {
  projectId: string;
  number: string;
  direction: string;
  date: Date | null;
  subject: string;
  url: string | null;
  counterpartyId: string | null;
  ownerId: string | null;
  dueDate: Date | null;
  status: string;
  statusNote: string | null;
  responseRef: string | null;
  externalTaskKey: string | null;
  comment: string | null;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projects: { id: string; code: string; name: string }[];
  counterparties: { id: string; name: string }[];
  members: { id: string; fullName: string }[];
  defaults?: LetterFormValues;
  submitLabel: string;
};

export function LetterForm({
  action,
  projects,
  counterparties,
  members,
  defaults,
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>
      )}

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
          Номер письма
          <input name="number" required defaultValue={defaults?.number} className="input" />
        </label>
        <label className="field">
          Направление
          <select name="direction" defaultValue={defaults?.direction ?? "INCOMING"} className="input">
            {LETTER_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {LETTER_DIRECTION_LABELS[direction]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Дата письма
          <input
            type="date"
            name="date"
            defaultValue={toDateInputValue(defaults?.date)}
            className="input"
          />
        </label>
      </div>

      <label className="field">
        Тема
        <input name="subject" required defaultValue={defaults?.subject} className="input" />
      </label>

      <label className="field">
        Ссылка на карточку в ЭДО
        <input
          name="url"
          defaultValue={defaults?.url ?? ""}
          placeholder="https://…"
          className="input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="field">
          Организация
          <select
            name="counterpartyId"
            defaultValue={defaults?.counterpartyId ?? ""}
            className="input"
          >
            <option value="">— не указан —</option>
            {counterparties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ответственный
          <select name="ownerId" defaultValue={defaults?.ownerId ?? ""} className="input">
            <option value="">— не назначен —</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Срок исполнения
          <input
            type="date"
            name="dueDate"
            defaultValue={toDateInputValue(defaults?.dueDate)}
            className="input"
          />
        </label>
        <label className="field">
          Статус
          <select name="status" defaultValue={defaults?.status ?? "IN_PROGRESS"} className="input">
            {LETTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LETTER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          Уточнение к статусу
          <input
            name="statusNote"
            defaultValue={defaults?.statusNote ?? ""}
            placeholder="На согласовании у…"
            className="input"
          />
        </label>
        <label className="field">
          Реквизиты ответа
          <input
            name="responseRef"
            defaultValue={defaults?.responseRef ?? ""}
            placeholder="№ и дата ответного письма"
            className="input"
          />
        </label>
        <label className="field">
          Задача во внешнем трекере
          <input
            name="externalTaskKey"
            defaultValue={defaults?.externalTaskKey ?? ""}
            placeholder="Ключ или ссылка"
            className="input"
          />
        </label>
      </div>

      <label className="field">
        Комментарий
        <textarea
          name="comment"
          rows={3}
          defaultValue={defaults?.comment ?? ""}
          className="input"
        />
      </label>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
