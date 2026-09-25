"use client";

import { useActionState, useState } from "react";
import { ArtifactFields, type ArtifactValue } from "@/components/artifact-fields";
import { KeepFormValues } from "@/components/keep-form-values";
import { VisibilityField } from "@/components/visibility-field";
import { SubmitButton } from "@/components/submit-button";
import { Pill } from "@/components/ui";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  NEW_TASK_STATUS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  toDateInputValue,
} from "@/lib/domain";
import { VISIBILITY_DEFAULTS } from "@/lib/visibility";
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
  artifacts: ArtifactValue[];
  isPublic: boolean;
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
  /** Треки всех проектов: список свой у каждого, форма показывает нужные. */
  tracks: { id: string; name: string; projectId: string }[];
  /** Задачи того же проекта — кандидаты в родительские. */
  parentCandidates?: { id: string; number: number; title: string }[];
  /** Письма проекта: задача часто заводится по конкретному письму. */
  letters?: { id: string; number: string; subject: string }[];
  /** Документы проекта: на них ссылается артефакт «Документ системы». */
  documents?: { id: string; title: string }[];
  /** Форма создания статус не спрашивает: новая задача всегда «Новая». */
  hideStatus?: boolean;
  /** Заведение задачи: видимость задаётся один раз, при создании. */
  isNew?: boolean;
  /** Администратор меняет видимость и после создания. */
  canChangeVisibility?: boolean;
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
  documents = [],
  hideStatus = false,
  isNew = false,
  canChangeVisibility = false,
  defaults,
  lockProject = false,
  submitLabel,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  // Проект в состоянии: при его смене список треков должен смениться тоже,
  // иначе задача уедет в один проект с треком другого.
  const [projectId, setProjectId] = useState(defaults?.projectId ?? projects[0]?.id ?? "");
  const projectTracks = tracks.filter((track) => track.projectId === projectId);

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <KeepFormValues state={state} />
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
          <select
            name="projectId"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            required
            className="input"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        Название
        <input
          name="title"
          required
          defaultValue={defaults?.title}
          placeholder="Что нужно сделать"
          className="input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          Трек
          {/* key по проекту: при смене проекта выбор сбрасывается на его
              первый трек, а не остаётся на треке прошлого проекта. */}
          <select
            key={projectId}
            name="trackId"
            defaultValue={
              projectTracks.some((track) => track.id === defaults?.trackId)
                ? defaults?.trackId
                : projectTracks[0]?.id
            }
            required
            className="input"
          >
            {projectTracks.length === 0 && <option value="">Треков нет</option>}
            {projectTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
        {/* Новая задача заводится со статусом «Новая», поэтому при создании
            статус не спрашиваем: его выставляют потом, по ходу работы. */}
        {hideStatus ? (
          <div className="field">
            Статус
            <input type="hidden" name="status" value={NEW_TASK_STATUS} />
            <span className="mt-1 flex flex-wrap items-center gap-2 py-1.5">
              <Pill tone="copper">{TASK_STATUS_LABELS[NEW_TASK_STATUS]}</Pill>
              <span className="text-xs font-normal text-gray-500 normal-case tracking-normal">двигается в самой задаче</span>
            </span>
          </div>
        ) : (
          <label className="field">
            Статус
            <select name="status" defaultValue={defaults?.status ?? NEW_TASK_STATUS} className="input">
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        )}
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
          Срок
          <input
            type="date"
            name="dueDate"
            defaultValue={toDateInputValue(defaults?.dueDate)}
            className="input"
          />
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
          Задача во внешнем трекере
          <input
            name="externalTaskKey"
            defaultValue={defaults?.externalTaskKey ?? ""}
            placeholder="Например, AISRKII-9837"
            className="input"
          />
        </label>
      </div>

      <ArtifactFields defaults={defaults?.artifacts} documents={documents} />

      <VisibilityField
        value={defaults?.isPublic ?? VISIBILITY_DEFAULTS.TASK}
        isNew={isNew}
        canChange={canChangeVisibility}
      />

      {/* Всё остальное по макету спрятано: при заведении задачи нужны
          название, трек, ответственный и срок, прочее дописывается позже. */}
      <details open={!isNew} className="group rounded-xl border border-gray-200">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-700 select-none">
          <span className="mr-1.5 inline-block transition group-open:rotate-90">›</span>
          Подробнее: описание, основание, сроки и трудозатраты
        </summary>
        <div className="space-y-4 border-t border-gray-200 px-4 py-4">
        <label className="field">
          Описание
          <textarea
            name="description"
            rows={3}
            defaultValue={defaults?.description ?? ""}
            className="input"
          />
        </label>

          <div className="grid gap-4 sm:grid-cols-2">
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
            Начало
            <input
              type="date"
              name="startDate"
              defaultValue={toDateInputValue(defaults?.startDate)}
              className="input"
            />
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

          <div className="grid gap-4 sm:grid-cols-3">
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
        </div>
      </details>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
