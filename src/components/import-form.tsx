"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importFromExcel, type ImportState } from "@/app/actions/import";
import { SubmitButton } from "@/components/submit-button";

const INITIAL: ImportState = { status: "idle" };

type Props = {
  projects: { id: string; code: string; name: string }[];
};

export function ImportForm({ projects }: Props) {
  const [state, formAction] = useActionState(importFromExcel, INITIAL);

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-4 p-5">
        <label className="field">
          Проект
          <select name="projectId" required defaultValue={projects[0]?.id} className="input">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Файл .xlsx
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:text-white"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="createMissingMembers" defaultChecked className="size-4" />
          Заводить сотрудников, которых нет в справочнике
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="dryRun" className="size-4" />
          Только проверить разбор, ничего не записывать
        </label>

        <SubmitButton pendingLabel="Загружаем…">Загрузить</SubmitButton>
      </form>

      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      {state.status === "done" && <ImportReportView state={state} />}
    </div>
  );
}

function ImportReportView({ state }: { state: Extract<ImportState, { status: "done" }> }) {
  const { report } = state;
  const isDryRun = report.created === 0 && report.updated === 0 && report.skipped === report.rowsTotal;

  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-gray-900">
        {isDryRun ? "Проверка разбора" : "Результат загрузки"}: {report.fileName}
      </h2>

      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <Stat label="Строк найдено" value={report.rowsTotal} />
        <Stat label="Создано" value={report.created} />
        <Stat label="Обновлено" value={report.updated} />
        <Stat label="Пропущено" value={report.skipped} />
      </dl>

      <p className="text-sm text-gray-600">
        Лист «{report.sheetName ?? "—"}», шапка в строке {report.headerRow ?? "—"}. Распознаны
        колонки: {report.recognizedColumns.join(", ") || "—"}.
      </p>

      {report.membersCreated.length > 0 && (
        <p className="text-sm text-gray-600">
          Заведены сотрудники: {[...new Set(report.membersCreated)].join(", ")}
        </p>
      )}

      {report.errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700">Строки с ошибками</p>
          <ul className="mt-1 space-y-0.5 text-sm text-red-700">
            {report.errors.slice(0, 20).map((error, index) => (
              <li key={`${error.row}-${index}`}>
                Строка {error.row}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isDryRun && (
        <Link href="/tasks" className="btn-secondary w-fit">
          Открыть задачи
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900">{value}</dd>
    </div>
  );
}
