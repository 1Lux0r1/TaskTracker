"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { QuickLetterState } from "@/app/actions/letters";
import { SubmitButton } from "@/components/submit-button";
import { answerCandidates, answerFieldLabel } from "@/lib/letters";
import {
  LETTER_DIRECTION_LABELS,
  LETTER_DIRECTIONS,
  LETTER_STATUS_LABELS,
  LETTER_STATUSES,
  LETTER_DIRECTION_TEXT,
  toDateInputValue,
} from "@/lib/domain";
import { VISIBILITY_OPTIONS } from "@/lib/visibility";

/** Поля, которые повторяются от письма к письму и остаются после сохранения. */
export type StickyLetterValues = {
  projectId: string;
  direction: string;
  date: string;
  counterpartyId: string;
  ownerId: string;
  status: string;
  visibility: string;
};

/** Поля самого письма: после сохранения очищаются под следующее. */
const BLANK_LETTER = {
  number: "",
  subject: "",
  dueDate: "",
  url: "",
  statusNote: "",
  responseRef: "",
  resolution: "",
  signatory: "",
  responseToId: "",
  externalTaskKey: "",
  comment: "",
};

const DUE_SHORTCUTS = [3, 7, 14];


type Props = {
  action: (state: QuickLetterState | null, formData: FormData) => Promise<QuickLetterState>;
  projects: { id: string; code: string; name: string }[];
  counterparties: { id: string; name: string }[];
  members: { id: string; fullName: string }[];
  /** Входящие письма: исходящее часто идёт ответом на одно из них. */
  answerLetters?: {
    id: string;
    number: string;
    subject: string;
    projectId: string;
    direction: string;
    responseToId: string | null;
  }[];
  sticky: StickyLetterValues;
  /** Срок из календаря: «внести письмо со сроком на этот день». */
  initialDueDate?: string;
};

export function QuickLetterForm({
  action,
  projects,
  counterparties,
  members,
  answerLetters = [],
  sticky,
  initialDueDate = "",
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const [values, setValues] = useState({ ...sticky, ...BLANK_LETTER, dueDate: initialDueDate });
  const [answerNotRequired, setAnswerNotRequired] = useState(false);
  const numberInput = useRef<HTMLInputElement>(null);

  // Письма вносят пачкой, поэтому после сохранения очищаем только само письмо,
  // а проект, направление, дату, организацию и ответственного оставляем.
  const savedCount = state?.saved.length ?? 0;
  const [handledCount, setHandledCount] = useState(0);
  if (savedCount !== handledCount) {
    setHandledCount(savedCount);
    setValues((current) => ({ ...current, ...BLANK_LETTER }));
    setAnswerNotRequired(false);
  }

  useEffect(() => {
    if (savedCount > 0) numberInput.current?.focus();
  }, [savedCount]);

  const set = <K extends keyof typeof values>(key: K) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const incoming = values.direction === "INCOMING";
  const text = incoming ? LETTER_DIRECTION_TEXT.INCOMING : LETTER_DIRECTION_TEXT.OUTGOING;
  // Ответ всегда на письмо того же проекта и противоположного направления,
  // поэтому список сужается вместе с выбором проекта и направления в форме.
  const candidates = answerCandidates(answerLetters, {
    direction: values.direction,
    projectId: values.projectId,
  });

  const shiftDue = (days: number) => {
    const base = values.date ? new Date(`${values.date}T00:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    setValues((current) => ({ ...current, dueDate: toDateInputValue(base) }));
  };

  return (
    // Ключ меняется после каждого сохранения: React 19 сбрасывает поля формы
    // сам, и без перемонтирования списки остались бы со старым выбором в DOM.
    <form action={formAction} key={handledCount} className="space-y-4">
      {state && !state.ok && state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="card space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-900">Письмо</h2>
          <span className="text-xs text-gray-400">Номер и тема обязательны</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <label className="field">
            {text.number}
            <input
              ref={numberInput}
              name="number"
              value={values.number}
              onChange={set("number")}
              required
              autoFocus
              className="input"
            />
          </label>
          <label className="field">
            Тема
            <input
              name="subject"
              value={values.subject}
              onChange={set("subject")}
              required
              className="input"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            {text.due}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                name="dueDate"
                value={answerNotRequired ? "" : values.dueDate}
                onChange={set("dueDate")}
                disabled={answerNotRequired}
                className="input w-44 disabled:bg-gray-100 disabled:text-gray-400"
              />
              {DUE_SHORTCUTS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => shiftDue(days)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  +{days} дн.
                </button>
              ))}
              {values.dueDate && !answerNotRequired && (
                <button
                  type="button"
                  onClick={() => setValues((current) => ({ ...current, dueDate: "" }))}
                  className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                >
                  убрать
                </button>
              )}
            </div>
            {/* Часть писем ответа не требует: тогда срок не нужен, а письмо
                сразу принимается к сведению. */}
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                name="answerNotRequired"
                checked={answerNotRequired}
                onChange={(event) => setAnswerNotRequired(event.target.checked)}
                className="h-4 w-4"
              />
              Ответ не требуется
            </label>
          </div>
          <label className="field">
            Ссылка на карточку в ЭДО
            <input
              name="url"
              value={values.url}
              onChange={set("url")}
              placeholder="https://…"
              className="input"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {incoming ? (
            <label className="field">
              Резолюция
              <textarea
                name="resolution"
                rows={2}
                value={values.resolution}
                onChange={set("resolution")}
                placeholder="Кому расписано и что поручено"
                className="input"
              />
            </label>
          ) : (
            <label className="field">
              Подписант
              <input
                name="signatory"
                value={values.signatory}
                onChange={set("signatory")}
                placeholder="Кто подписал письмо"
                className="input"
              />
            </label>
          )}
          <label className="field">
            {answerFieldLabel(values.direction)}
            <select
              name="responseToId"
              value={values.responseToId}
              onChange={set("responseToId")}
              className="input"
            >
              <option value="">— не выбрано —</option>
              {candidates.map((letter) => (
                <option key={letter.id} value={letter.id}>
                  № {letter.number} — {letter.subject.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <details className="rounded-lg border border-gray-200 p-3">
          <summary className="cursor-pointer text-sm text-gray-600">Дополнительные поля</summary>
          <div className="mt-3 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="field">
                Уточнение к статусу
                <input
                  name="statusNote"
                  value={values.statusNote}
                  onChange={set("statusNote")}
                  placeholder="На согласовании у…"
                  className="input"
                />
              </label>
              <label className="field">
                Реквизиты ответа
                <input
                  name="responseRef"
                  value={values.responseRef}
                  onChange={set("responseRef")}
                  placeholder="№ и дата ответного письма"
                  className="input"
                />
              </label>
              <label className="field">
                Задача во внешнем трекере
                <input
                  name="externalTaskKey"
                  value={values.externalTaskKey}
                  onChange={set("externalTaskKey")}
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
                value={values.comment}
                onChange={set("comment")}
                className="input"
              />
            </label>
          </div>
        </details>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-900">Общее для пачки</h2>
          <span className="text-xs text-gray-400">Остаётся заполненным для следующего письма</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {projects.length > 1 && (
            <label className="field">
              Проект
              <select
                name="projectId"
                value={values.projectId}
                onChange={set("projectId")}
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
          )}
          {projects.length === 1 && (
            <input type="hidden" name="projectId" value={values.projectId} />
          )}
          <label className="field">
            Направление
            <select
              name="direction"
              value={values.direction}
              onChange={set("direction")}
              className="input"
            >
              {LETTER_DIRECTIONS.map((direction) => (
                <option key={direction} value={direction}>
                  {LETTER_DIRECTION_LABELS[direction]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {text.date}
            <input
              type="date"
              name="date"
              value={values.date}
              onChange={set("date")}
              className="input"
            />
          </label>
          <label className="field">
            {text.counterparty}
            <select
              name="counterpartyId"
              value={values.counterpartyId}
              onChange={set("counterpartyId")}
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
            <select name="ownerId" value={values.ownerId} onChange={set("ownerId")} className="input">
              <option value="">— не назначен —</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Статус
            <select name="status" value={values.status} onChange={set("status")} className="input">
              {LETTER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LETTER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Видимость
            <select
              name="visibility"
              value={values.visibility}
              onChange={set("visibility")}
              className="input"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.note.toLowerCase()}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-gray-500">
              Задаётся при заведении: дальше её меняет только администратор
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Сохранить и внести следующее</SubmitButton>
        <Link href="/letters" className="btn-secondary">
          Закончить
        </Link>
      </div>

      {state?.saved && state.saved.length > 0 && (
        <div className="card space-y-2 p-5">
          <p className="text-sm font-medium text-gray-900">
            Внесено подряд: {state.saved.length}
          </p>
          <ul className="space-y-1 text-sm text-gray-600">
            {state.saved.map((letter) => (
              <li key={letter.id}>
                <Link href={`/letters/${letter.id}`} className="text-gray-900 hover:underline">
                  № {letter.number}
                </Link>{" "}
                <span className="text-gray-500">{letter.subject}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
