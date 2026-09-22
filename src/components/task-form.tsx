"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  toDateInputValue,
} from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

export type TaskFormValues = {
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  externalAssignee: string | null;
  externalTaskKey: string | null;
  trackId: string;
  progressNote: string | null;
  resultLink: string | null;
  letterId: string | null;
  parentId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  estimateHours: number | null;
  spentHours: number | null;
  progress: number;
};

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  projects: { id: string; code: string; name: string }[];
  members: { id: string; fullName: string }[];
  /** Треки выбранного проекта: список свой у каждого проекта. */
  tracks: { id: string; name: string }[];
  /** Задачи того же проекта — кандидаты в родительские. */
  parentCandidates?: { id: string; number: number; title: string }[];
  /** Письма проекта: задача часто заводится по конкретному письму. */
  letters?: { id: string; number: string; subject: string }[];
  defaults?: TaskFormValues;
  lockProject?: boolean;
  submitLabel: string;
};

export function TaskForm({
  action,
  projects,
  members,
  tracks,
  parentCandidates = [],
  letters = [],
  defaults,
  lockProject = false,
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const projectId = defaults?.projectId ?? projects[0]?.id ?? "";

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>
      )}

      {lockProject ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : (
        <label className="field">
          Проект
          <select name="projectId" defaultValue={projectId} required className="input">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="field sm:col-span-3">
          Задача
          <input name="title" required defaultValue={defaults?.title} className="input" />
        </label>
        <label className="field">
          Трек
          <select
            name="trackId"
            defaultValue={defaults?.trackId ?? tracks[0]?.id ?? ""}
            className="input"
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Описание
        <textarea
          name="description"
          rows={3}
          defaultValue={defaults?.description ?? ""}
          className="input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className="field">
          Статус
          <select name="status" defaultValue={defaults?.status ?? "TODO"} className="input">
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Приоритет
          <select name="priority" defaultValue={defaults?.priority ?? "MEDIUM"} className="input">
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ответственный
          <select name="assigneeId" defaultValue={defaults?.assigneeId ?? ""} className="input">
            <option value="">— не назначен —</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Входит в задачу
          <select name="parentId" defaultValue={defaults?.parentId ?? ""} className="input">
            <option value="">— самостоятельная —</option>
            {parentCandidates.map((task) => (
              <option key={task.id} value={task.id}>
                #{task.number} {task.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field">
          Ключ задачи во внешнем трекере
          <input
            name="externalTaskKey"
            defaultValue={defaults?.externalTaskKey ?? ""}
            placeholder="Например, AISRKII-9837"
            className="input"
          />
        </label>
        <label className="field">
          Внешний ответственный
          <input
            name="externalAssignee"
            defaultValue={defaults?.externalAssignee ?? ""}
            placeholder="Организация и контактное лицо"
            className="input"
          />
        </label>
        <label className="field">
          Письмо-основание
          <select name="letterId" defaultValue={defaults?.letterId ?? ""} className="input">
            <option value="">— без письма —</option>
            {letters.map((letter) => (
              <option key={letter.id} value={letter.id}>
                № {letter.number} — {letter.subject.slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Ход работы
        <textarea
          name="progressNote"
          rows={3}
          defaultValue={defaults?.progressNote ?? ""}
          placeholder="Хронология: что и когда произошло по задаче"
          className="input"
        />
      </label>

      <label className="field">
        Ссылка на результат
        <input
          name="resultLink"
          defaultValue={defaults?.resultLink ?? ""}
          placeholder="https://…"
          className="input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-5">
        <label className="field">
          Начало
          <input
            type="date"
            name="startDate"
            defaultValue={toDateInputValue(defaults?.startDate)}
            className="input"
          />
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
          Оценка, ч
          <input
            type="number"
            step="0.5"
            min="0"
            name="estimateHours"
            defaultValue={defaults?.estimateHours ?? ""}
            className="input"
          />
        </label>
        <label className="field">
          Факт, ч
          <input
            type="number"
            step="0.5"
            min="0"
            name="spentHours"
            defaultValue={defaults?.spentHours ?? ""}
            className="input"
          />
        </label>
        <label className="field">
          Готовность, %
          <input
            type="number"
            min="0"
            max="100"
            name="progress"
            defaultValue={defaults?.progress ?? 0}
            className="input"
          />
        </label>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
