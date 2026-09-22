"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUSES,
  toDateInputValue,
} from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type DocumentFormValues = {
  projectId: string;
  kind: string;
  title: string;
  counterpartyId: string | null;
  ownerId: string | null;
  status: string;
  statusNote: string | null;
  nextAction: string | null;
  dueDate: Date | null;
  outgoingLetterId: string | null;
  incomingLetterId: string | null;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projects: { id: string; code: string; name: string }[];
  counterparties: { id: string; name: string }[];
  members: { id: string; fullName: string }[];
  letters: { id: string; number: string; direction: string; subject: string }[];
  defaults?: DocumentFormValues;
  /** Статус выводится из подписей сторон, поэтому у существующего документа он только для чтения. */
  statusDerived?: boolean;
  submitLabel: string;
};

export function DocumentForm({
  action,
  projects,
  counterparties,
  members,
  letters,
  defaults,
  statusDerived = false,
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const outgoing = letters.filter((item) => item.direction === "OUTGOING");
  const incoming = letters.filter((item) => item.direction === "INCOMING");

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
          Вид документа
          <select name="kind" defaultValue={defaults?.kind ?? "REGULATION"} className="input">
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {DOCUMENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="field sm:col-span-2">
          Название
          <input name="title" required defaultValue={defaults?.title} className="input" />
        </label>
      </div>

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
          Срок
          <input
            type="date"
            name="dueDate"
            defaultValue={toDateInputValue(defaults?.dueDate)}
            className="input"
          />
        </label>
        <label className="field">
          Статус
          <select
            name="status"
            defaultValue={defaults?.status ?? "DRAFT"}
            disabled={statusDerived}
            className="input disabled:bg-gray-50 disabled:text-gray-500"
          >
            {DOCUMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DOCUMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          {statusDerived && (
            <>
              <input type="hidden" name="status" value={defaults?.status ?? "DRAFT"} />
              <span className="mt-1 block text-xs font-normal text-gray-500">
                Считается по подписям сторон ниже
              </span>
            </>
          )}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Письмо, которым направлен
          <select
            name="outgoingLetterId"
            defaultValue={defaults?.outgoingLetterId ?? ""}
            className="input"
          >
            <option value="">— не указано —</option>
            {outgoing.map((item) => (
              <option key={item.id} value={item.id}>
                № {item.number} — {item.subject.slice(0, 50)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Письмо с ответом
          <select
            name="incomingLetterId"
            defaultValue={defaults?.incomingLetterId ?? ""}
            className="input"
          >
            <option value="">— не указано —</option>
            {incoming.map((item) => (
              <option key={item.id} value={item.id}>
                № {item.number} — {item.subject.slice(0, 50)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Уточнение к статусу
        <input
          name="statusNote"
          defaultValue={defaults?.statusNote ?? ""}
          placeholder="Например: в наличии в 3 экземплярах"
          className="input"
        />
      </label>

      <label className="field">
        Что нужно сделать дальше
        <textarea
          name="nextAction"
          rows={2}
          defaultValue={defaults?.nextAction ?? ""}
          className="input"
        />
      </label>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
