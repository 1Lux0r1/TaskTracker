"use client";

import { useActionState, useState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { VisibilityField } from "@/components/visibility-field";
import { VISIBILITY_DEFAULTS } from "@/lib/visibility";
import { SubmitButton } from "@/components/submit-button";
import {
  LETTER_DIRECTION_LABELS,
  LETTER_DIRECTIONS,
  LETTER_STATUS_LABELS,
  LETTER_STATUSES,
  LETTER_DIRECTION_TEXT,
  toDateInputValue,
} from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type LetterFormValues = {
  id?: string;
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
  resolution: string | null;
  signatory: string | null;
  responseToId: string | null;
  externalTaskKey: string | null;
  comment: string | null;
  isPublic: boolean;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projects: { id: string; code: string; name: string }[];
  counterparties: { id: string; name: string }[];
  members: { id: string; fullName: string }[];
  /** Входящие письма: исходящее часто идёт ответом на одно из них. */
  incomingLetters?: { id: string; number: string; subject: string; projectId: string }[];
  defaults?: LetterFormValues;
  /** Администратор меняет видимость письма и после создания. */
  canChangeVisibility?: boolean;
  submitLabel: string;
};

export function LetterForm({
  action,
  projects,
  counterparties,
  members,
  incomingLetters = [],
  defaults,
  canChangeVisibility = false,
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  // Направление и проект в состоянии: от них зависят подписи полей, состав
  // формы и список писем, на которые можно ответить.
  const [direction, setDirection] = useState(defaults?.direction ?? "INCOMING");
  const [projectId, setProjectId] = useState(defaults?.projectId ?? projects[0]?.id ?? "");

  const incoming = direction === "INCOMING";
  const text = incoming ? LETTER_DIRECTION_TEXT.INCOMING : LETTER_DIRECTION_TEXT.OUTGOING;
  const answerCandidates = incomingLetters.filter(
    (letter) => letter.projectId === projectId && letter.id !== defaults?.id,
  );

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <KeepFormValues state={state} />
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
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
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
          Направление
          <select
            name="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="input"
          >
            {LETTER_DIRECTIONS.map((item) => (
              <option key={item} value={item}>
                {LETTER_DIRECTION_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {text.number}
          <input name="number" required defaultValue={defaults?.number} className="input" />
        </label>
        <label className="field">
          {text.date}
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

      {/* Состав полей меняется по направлению: у входящего резолюция,
          у исходящего подписант и письмо-основание. */}
      {incoming ? (
        <label className="field">
          Резолюция
          <textarea
            name="resolution"
            rows={2}
            defaultValue={defaults?.resolution ?? ""}
            placeholder="Кому расписано и что поручено"
            className="input"
          />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Подписант
            <input
              name="signatory"
              defaultValue={defaults?.signatory ?? ""}
              placeholder="Кто подписал письмо"
              className="input"
            />
          </label>
          <label className="field">
            В ответ на входящее
            {/* key по проекту: при смене проекта выбор не должен остаться
                на письме другого проекта. */}
            <select
              key={projectId}
              name="responseToId"
              defaultValue={
                answerCandidates.some((letter) => letter.id === defaults?.responseToId)
                  ? (defaults?.responseToId ?? "")
                  : ""
              }
              className="input"
            >
              <option value="">— не выбрано —</option>
              {answerCandidates.map((letter) => (
                <option key={letter.id} value={letter.id}>
                  № {letter.number} — {letter.subject.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="field">
          {text.counterparty}
          <select
            name="counterpartyId"
            defaultValue={defaults?.counterpartyId ?? ""}
            className="input"
          >
            <option value="">— не указана —</option>
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
          {text.due}
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

      <VisibilityField
        value={defaults?.isPublic ?? VISIBILITY_DEFAULTS.LETTER}
        canChange={canChangeVisibility}
      />

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
