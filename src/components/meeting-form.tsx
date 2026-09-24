"use client";

import { useActionState, useState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import { SubmitButton } from "@/components/submit-button";
import {
  MEETING_KIND_LABELS,
  MEETING_KINDS,
  toDateInputValue,
} from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type MeetingFormValues = {
  projectId: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  place: string | null;
  kind: string;
  subject: string;
  agenda: string | null;
  decisions: string | null;
  ownerId: string | null;
  participants: {
    memberId: string | null;
    orgContactId: string | null;
    externalName: string | null;
  }[];
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projects: { id: string; code: string; name: string }[];
  members: { id: string; fullName: string }[];
  /** Представители организаций: справочник ответственных лиц. */
  contacts: { id: string; fullName: string; counterparty: string; position: string | null }[];
  defaults?: MeetingFormValues;
  submitLabel: string;
};

export function MeetingForm({
  action,
  projects,
  members,
  contacts,
  defaults,
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  // Гостей вписывают именем: в справочниках их ещё нет, а в протоколе они есть.
  const [guests, setGuests] = useState<string[]>(
    defaults?.participants
      .map((item) => item.externalName)
      .filter((name): name is string => Boolean(name)) ?? [],
  );

  const chosenMembers = new Set(
    defaults?.participants.map((item) => item.memberId).filter(Boolean) ?? [],
  );
  const chosenContacts = new Set(
    defaults?.participants.map((item) => item.orgContactId).filter(Boolean) ?? [],
  );

  return (
    <form action={formAction} className="space-y-4">
      <KeepFormValues state={state} />
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>
      )}

      <div className="card space-y-4 p-5">
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
            Дата
            <input
              type="date"
              name="date"
              required
              defaultValue={toDateInputValue(defaults?.date)}
              className="input"
            />
          </label>
          <label className="field">
            Начало
            <input
              type="time"
              name="startTime"
              defaultValue={defaults?.startTime ?? ""}
              className="input"
            />
          </label>
          <label className="field">
            Окончание
            <input
              type="time"
              name="endTime"
              defaultValue={defaults?.endTime ?? ""}
              className="input"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label className="field sm:col-span-2">
            Тема
            <input name="subject" required defaultValue={defaults?.subject} className="input" />
          </label>
          <label className="field">
            Вид
            <select name="kind" defaultValue={defaults?.kind ?? "WORKING"} className="input">
              {MEETING_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {MEETING_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Место или ссылка
            <input
              name="place"
              defaultValue={defaults?.place ?? ""}
              placeholder="Кабинет или адрес видеовстречи"
              className="input"
            />
          </label>
        </div>

        <label className="field">
          Кто ведёт запись
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

      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Участники</h2>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">Наши</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <label key={member.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="memberId"
                  value={member.id}
                  defaultChecked={chosenMembers.has(member.id)}
                  className="h-4 w-4"
                />
                {member.fullName}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">Представители организаций</legend>
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-500">
              Справочник представителей пуст: впишите участников именем ниже.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="orgContactId"
                    value={contact.id}
                    defaultChecked={chosenContacts.has(contact.id)}
                    className="h-4 w-4"
                  />
                  <span>
                    {contact.fullName}
                    <span className="text-gray-500">
                      {" "}
                      — {contact.counterparty}
                      {contact.position ? `, ${contact.position}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700">Остальные</legend>
          {guests.map((guest, index) => (
            <div key={index} className="flex gap-2">
              <input
                name="externalName"
                defaultValue={guest}
                placeholder="ФИО и организация"
                className="input"
              />
              <button
                type="button"
                onClick={() => setGuests((current) => current.filter((_, i) => i !== index))}
                className="btn-secondary shrink-0"
              >
                Убрать
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setGuests((current) => [...current, ""])}
            className="text-sm text-gray-600 hover:underline"
          >
            + вписать участника
          </button>
        </fieldset>
      </div>

      <div className="card space-y-4 p-5">
        <label className="field">
          Повестка
          <textarea
            name="agenda"
            rows={4}
            defaultValue={defaults?.agenda ?? ""}
            placeholder="Вопросы к обсуждению, по одному в строке"
            className="input"
          />
        </label>
        <label className="field">
          Решения
          <textarea
            name="decisions"
            rows={4}
            defaultValue={defaults?.decisions ?? ""}
            placeholder="Что решили. Из решения заводится задача в карточке встречи"
            className="input"
          />
        </label>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
