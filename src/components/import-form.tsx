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
        <div className="grid gap-4 sm:grid-cols-2">
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
            Что загружаем
            <select name="kind" defaultValue="tasks" className="input">
              <option value="tasks">Реестр задач</option>
              <option value="letters">Реестр переписки ЭДО</option>
              <option value="documents:REGULATION">Реестр подписания регламентов</option>
              <option value="documents:NDA_ANNEX">Реестр подписания ДС к NDA</option>
            </select>
          </label>
        </div>

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

        <label className="field">
          Лист книги
          <input
            name="sheetName"
            placeholder="Пусто — выбрать автоматически"
            className="input"
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Если в файле несколько реестров, укажите имя листа точно как в Excel.
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="createMissingMembers" defaultChecked className="size-4" />
          Заводить сотрудников, которых нет в справочнике
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="createMissingCounterparties"
            defaultChecked
            className="size-4"
          />
          Заводить организации, которых нет в справочнике
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="dryRun" className="size-4" />
          Только разобрать файл и показать, что в нём нашлось
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

      <dl className="grid gap-3 text-sm sm:grid-cols-5">
        <Stat label="Строк найдено" value={report.rowsTotal} />
        <Stat label="Создано" value={report.created} />
        <Stat label="Обновлено" value={report.updated} />
        <Stat label="Пропущено" value={report.skipped} />
        <Stat label="Записей хроники" value={report.notesCreated} />
      </dl>

      {report.sheets.length > 1 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-head">Лист в файле</th>
                <th className="table-head w-28">Строк</th>
                <th className="table-head w-40">Похож на</th>
                <th className="table-head">Распознанные колонки</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.sheets.map((sheet) => (
                <tr key={sheet.name} className={sheet.name === report.sheetName ? "bg-amber-50" : ""}>
                  <td className="table-cell font-medium text-gray-900">{sheet.name}</td>
                  <td className="table-cell tabular-nums">{sheet.rowCount}</td>
                  <td className="table-cell">
                    {sheet.suggestedKind === "letters"
                      ? "переписку"
                      : sheet.suggestedKind === "tasks"
                        ? "реестр задач"
                        : "не распознан"}
                  </td>
                  <td className="table-cell text-xs text-gray-500">
                    {sheet.recognizedColumns.join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-600">
        Лист «{report.sheetName ?? "—"}», шапка в строке {report.headerRow ?? "—"}. Распознаны
        колонки: {report.recognizedColumns.join(", ") || "—"}.
      </p>

      {report.membersCreated.length > 0 && (
        <p className="text-sm text-gray-600">
          Заведены сотрудники: {[...new Set(report.membersCreated)].join(", ")}
        </p>
      )}

      {report.counterpartiesCreated.length > 0 && (
        <p className="text-sm text-gray-600">
          Заведены организации: {[...new Set(report.counterpartiesCreated)].join(", ")}
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
        <Link href={reportHref(report.kind)} className="btn-secondary w-fit">
          {reportLinkLabel(report.kind)}
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

/** Куда вести после загрузки: реестр того же вида, что и загруженный. */
function reportHref(kind: string): string {
  if (kind === "letters") return "/letters";
  if (kind === "documents") return "/documents";
  return "/tasks";
}

function reportLinkLabel(kind: string): string {
  if (kind === "letters") return "Открыть переписку";
  if (kind === "documents") return "Открыть юридический трек";
  return "Открыть задачи";
}
