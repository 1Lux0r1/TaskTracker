"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/domain";
import {
  CIPHER_SETTINGS,
  buildCipher,
  formatPlanNumber,
  nextRepeat,
  stageWithRepeat,
} from "@/lib/planning/cipher";
import { resolvePlanDates } from "@/lib/planning/dates";
import type { ActionResult } from "@/lib/validation";

export type CalculatorData = {
  system: { code: string };
  blocks: {
    partId: string;
    directionCode: string;
    partCode: string;
    label: string;
    dks: { id: string; number: number; name: string; subsystemCode: string | null }[];
  }[];
  modules: { id: string; number: number; name: string; subsystemCode: string }[];
  stages: { id: string; code: string; name: string; level: string }[];
  existing: { id: string; dkId: string; stageId: string; moduleId: string | null; repeat: number; cipher: string }[];
};

export type CalculatorDefaults = {
  taskId?: string;
  dkId?: string;
  moduleId?: string | null;
  stageId?: string;
  repeat?: number;
  name?: string;
  start?: string;
  weeks?: string;
  finish?: string;
};

type Props = {
  data: CalculatorData;
  defaults?: CalculatorDefaults;
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
};

/**
 * Калькулятор шифра и форма задачи плана в одном: выбор по цепочке
 * система → блок → ДК → МС → этап. Шифр считается тем же модулем, что и на
 * сервере; сервер при записи проверяет всё заново.
 */
export function CipherCalculator({ data, defaults = {}, action, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, null);

  const initialBlock =
    data.blocks.find((block) => block.dks.some((dk) => dk.id === defaults.dkId))?.partId ??
    data.blocks[0]?.partId ??
    "";
  const [partId, setPartId] = useState(initialBlock);
  const [dkId, setDkId] = useState(defaults.dkId ?? "");
  const [moduleId, setModuleId] = useState(defaults.moduleId ?? "");
  const [stageId, setStageId] = useState(defaults.stageId ?? "");
  const [repeatText, setRepeatText] = useState(defaults.repeat ? String(defaults.repeat) : "");
  const [start, setStart] = useState(defaults.start ?? "");
  const [weeks, setWeeks] = useState(defaults.weeks ?? "");
  const [finish, setFinish] = useState(defaults.finish ?? "");
  // Поля управляемые: React сбрасывает форму после действия, а выбор по
  // цепочке и введённое должны пережить и ошибку, и успешное добавление.
  const [name, setName] = useState(defaults.name ?? "");

  const block = data.blocks.find((item) => item.partId === partId);
  const dk = block?.dks.find((item) => item.id === dkId);
  const stage = data.stages.find((item) => item.id === stageId);
  const msAllowed = stage?.level !== "DK";
  const ms = msAllowed ? data.modules.find((item) => item.id === moduleId) : undefined;

  const siblings = useMemo(
    () =>
      data.existing.filter(
        (task) =>
          task.id !== defaults.taskId &&
          task.dkId === dkId &&
          task.stageId === stageId &&
          (task.moduleId ?? "") === (ms?.id ?? ""),
      ),
    [data.existing, defaults.taskId, dkId, stageId, ms],
  );
  const suggested = nextRepeat(siblings.map((task) => task.repeat));
  const repeat = repeatText.trim() ? Number(repeatText) : suggested;

  const cipher = buildCipher(
    {
      system: data.system.code,
      direction: block?.directionCode,
      part: block?.partCode,
      dkSubsystem: dk?.subsystemCode,
      msSubsystem: ms?.subsystemCode,
      dkNumber: dk?.number,
      msNumber: ms?.number,
      stage: stage?.code,
      repeat,
    },
    CIPHER_SETTINGS,
  );

  const taken = data.existing.find((task) => task.id !== defaults.taskId && task.cipher === cipher);
  const problem = !block
    ? "Выберите блок: направление и часть"
    : !dk
      ? "Выберите ДК"
      : !stage
        ? "Выберите этап"
        : stage.level === "MS" && !ms
          ? `Этап «${stage.code}» ведётся по МС: выберите МС`
          : !Number.isInteger(repeat) || repeat < 1
            ? "Номер повтора — целое число от 1"
            : null;
  const status: "incomplete" | "taken" | "ready" = problem ? "incomplete" : taken ? "taken" : "ready";

  const dates = resolvePlanDates({
    start: start ? new Date(`${start}T00:00:00`) : null,
    weeks: weeks.trim() ? Number(weeks.replace(",", ".")) : null,
    finish: finish ? new Date(`${finish}T00:00:00`) : null,
  });

  return (
    <form action={formAction} className="grid gap-3.5 lg:grid-cols-2">
      <input type="hidden" name="dkId" value={dk?.id ?? ""} />
      <input type="hidden" name="stageId" value={stage?.id ?? ""} />
      <input type="hidden" name="moduleId" value={ms?.id ?? ""} />
      <input type="hidden" name="repeat" value={repeatText.trim() ? repeatText : ""} />
      {defaults.taskId && <input type="hidden" name="id" value={defaults.taskId} />}

      <section className="card p-4.5">
        <h2 className="font-display text-[15.5px] font-semibold text-gray-900">Выбор по цепочке</h2>
        <div className="mt-3 space-y-3">
          <label className="field">
            Система
            <input value={data.system.code} readOnly className="input bg-gray-50 font-mono" />
          </label>
          <label className="field">
            Направление · часть
            <select
              value={partId}
              onChange={(event) => {
                setPartId(event.target.value);
                setDkId("");
              }}
              className="input"
            >
              {data.blocks.length === 0 && <option value="">Блоков пока нет</option>}
              {data.blocks.map((item) => (
                <option key={item.partId} value={item.partId}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            ДК
            <select value={dkId} onChange={(event) => setDkId(event.target.value)} className="input">
              <option value="">— без ДК: только код блока —</option>
              {block?.dks.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatPlanNumber(item.number)} · {item.name}
                  {item.subsystemCode ? ` (${item.subsystemCode})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            МС
            <select
              value={msAllowed ? moduleId : ""}
              onChange={(event) => setModuleId(event.target.value)}
              disabled={!msAllowed}
              className="input disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">{msAllowed ? "— без МС: задача по ДК —" : "Этап ведётся по ДК"}</option>
              {data.modules.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatPlanNumber(item.number)} · {item.name} ({item.subsystemCode})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <label className="field">
              Этап
              <select value={stageId} onChange={(event) => setStageId(event.target.value)} className="input">
                <option value="">Выберите этап</option>
                {data.stages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Повтор
              <input
                inputMode="numeric"
                value={repeatText}
                onChange={(event) => setRepeatText(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder={`авто: ${suggested}`}
                className="input"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="card flex flex-col p-4.5">
        <h2 className="font-display text-[15.5px] font-semibold text-gray-900">Шифр</h2>
        <p className="mt-3 rounded-lg bg-gray-100 px-3.5 py-3 font-mono text-lg font-semibold break-all text-gray-900">
          {cipher || "—"}
        </p>
        <div className="mt-2.5 text-sm">
          {status === "ready" && (
            <span className="badge bg-green-50 text-green-700">Готов: такого шифра в плане нет</span>
          )}
          {status === "taken" && taken && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="badge bg-amber-50 text-amber-700">Уже есть в плане</span>
              <Link href={`/planning/tasks/${taken.id}`} className="text-brand hover:underline">
                открыть задачу
              </Link>
              <span className="text-gray-600">· следующий свободный повтор — {stageWithRepeat(stage?.code ?? "", suggested)}</span>
            </span>
          )}
          {status === "incomplete" && <span className="text-gray-500">{problem}</span>}
        </div>
        {siblings.length > 0 && (
          <p className="mt-2 text-[13px] text-gray-600">
            Этот этап уже в плане:{" "}
            {siblings
              .map((task) => task.repeat)
              .sort((a, b) => a - b)
              .map((value) => stageWithRepeat(stage?.code ?? "", value))
              .join(", ")}
            . Следующий номер повтора — {suggested}.
          </p>
        )}

        <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-3">
          <label className="field sm:col-span-3">
            Наименование задачи
            <input
              name="name"
              required
              maxLength={300}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input"
            />
          </label>
          <label className="field">
            Старт
            <input type="date" name="startDate" value={start} onChange={(event) => setStart(event.target.value)} className="input" />
          </label>
          <label className="field">
            Недель
            <input
              name="durationWeeks"
              inputMode="numeric"
              value={weeks}
              onChange={(event) => setWeeks(event.target.value)}
              className="input"
            />
          </label>
          <label className="field">
            Финиш
            <input type="date" name="finishDate" value={finish} onChange={(event) => setFinish(event.target.value)} className="input" />
          </label>
          <p className="text-[13px] text-gray-500 sm:col-span-3">
            {!dates.ok
              ? dates.error
              : dates.value.start
                ? `${formatDate(dates.value.start)} – ${formatDate(dates.value.finish)}, ${dates.value.weeks} нед.`
                : "Достаточно двух значений из трёх, третье посчитается."}
          </p>
        </div>

        {state && !state.ok && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && state.message && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>
        )}
        <div className="mt-auto pt-4">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </section>
    </form>
  );
}
