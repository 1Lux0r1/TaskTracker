"use client";

import { useActionState, useState, useTransition } from "react";
import { type BookImportState, importPlanningBook } from "@/app/actions/planning";
import { plural } from "@/lib/domain";

/**
 * Загрузка книги планирования в два шага: «Проверить» показывает, что и
 * сколько ляжет в систему и что в книге не сходится, ничего не меняя;
 * «Загрузить в систему» пишет тот же файл. Файл держится в браузере между
 * шагами, выбирать его второй раз не нужно.
 */
export function BookImport() {
  const [state, formAction] = useActionState<BookImportState, FormData>(importPlanningBook, null);
  const [file, setFile] = useState<File | null>(null);
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"check" | "apply" | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (next: "check" | "apply") => {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    data.set("mode", next);
    setMode(next);
    startTransition(() => {
      formAction(data);
      if (next === "check") setCheckedFile(file);
    });
  };

  const checked = state?.ok && !state.applied && checkedFile === file;
  const problems = state?.ok ? state.problems : [];

  return (
    <div className="space-y-3.5">
      <section className="card p-4.5">
        <h2 className="font-display text-[15.5px] font-semibold text-gray-900">Файл книги</h2>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Книга «Планирование развития системы» в формате .xlsx: листы «Справочник», «ОФТ», «Дорожная карта» и «План
          работ». Повторная загрузка обновляет записи по коду и шифру, дублей не будет.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="input mt-0 max-w-md flex-1"
            aria-label="Файл книги"
          />
          <button type="button" onClick={() => send("check")} disabled={!file || pending} className="btn-secondary">
            {pending && mode === "check" ? "Проверяем…" : "Проверить"}
          </button>
          <button type="button" onClick={() => send("apply")} disabled={!checked || pending} className="btn-primary">
            {pending && mode === "apply" ? "Загружаем…" : "Загрузить в систему"}
          </button>
        </div>
        {!checked && file && !pending && (
          <p className="mt-2 text-[13px] text-gray-500">Сначала проверка: она покажет, что ляжет в систему, и ничего не изменит.</p>
        )}
        {state && !state.ok && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
      </section>

      {state?.ok && (
        <>
          <section className={`card p-4.5 ${state.applied ? "border-emerald-200" : ""}`}>
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                state.applied ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
              }`}
            >
              {state.applied
                ? `Книга «${state.fileName}» загружена.`
                : `Проверка книги «${state.fileName}»: база не изменена. Если всё верно — «Загрузить в систему».`}
            </p>
            <h2 className="mt-3.5 font-display text-[15.5px] font-semibold text-gray-900">
              {state.applied ? "Записано" : "Будет записано"}
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(state.counts).map(([what, { created, updated }], index, all) => (
                <li
                  key={what}
                  // Нечётная последняя плашка — на всю ширину: ряд не разъезжается.
                  className={`${all.length % 2 === 1 && index === all.length - 1 ? "sm:col-span-2 " : ""}flex items-baseline justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm`}
                >
                  <span className="text-gray-700">{what}</span>
                  <span className="text-gray-900 tabular-nums">
                    {created > 0 && <span className="font-semibold">новых {created}</span>}
                    {created > 0 && updated > 0 && " · "}
                    {updated > 0 && <span>обновлено {updated}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <details className="mt-3 text-[13px] text-gray-500">
              <summary className="cursor-pointer">Что найдено в книге</summary>
              <ul className="mt-1.5 space-y-0.5">
                {state.found.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          </section>

          <section className="card p-4.5">
            <h2 className="font-display text-[15.5px] font-semibold text-gray-900">
              {problems.length
                ? `Замечания по книге: ${problems.length}`
                : "Замечаний нет"}
            </h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {problems.length
                ? `Строки с замечаниями пропускаются, остальное загружается: ${problems.length} ${plural(problems.length, "замечание", "замечания", "замечаний")}. Поправьте книгу и загрузите её снова — записи обновятся.`
                : "Все строки книги сходятся с правилами кода."}
            </p>
            {problems.length > 0 && (
              <ul className="mt-2.5 max-h-[480px] space-y-1 overflow-y-auto">
                {problems.map((line, index) => (
                  <li key={index} className="rounded-lg bg-amber-50 px-3 py-1.5 text-[13px] text-amber-800">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
