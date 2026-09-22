"use client";

import { useState } from "react";
import { ARTIFACT_KINDS } from "@/lib/domain";

export type ArtifactValue = {
  kind: string;
  label: string;
  value: string;
};

type Props = {
  defaults?: ArtifactValue[];
  /** Документы проекта: артефакт вида «Документ системы» ссылается на них. */
  documents?: { id: string; title: string }[];
};

const EMPTY: ArtifactValue = { kind: "EDO_LINK", label: "", value: "" };

/**
 * Артефакты задачи: строк столько, сколько нужно. Поля уходят повторяющимися
 * именами, действие собирает их через formData.getAll.
 */
export function ArtifactFields({ defaults = [], documents = [] }: Props) {
  const [rows, setRows] = useState<ArtifactValue[]>(defaults.length > 0 ? defaults : []);

  function update(index: number, patch: Partial<ArtifactValue>) {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Артефакты</span>
        <button type="button" className="btn-secondary" onClick={() => setRows([...rows, EMPTY])}>
          + ещё артефакт
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-gray-500">
          Чем подтверждается работа: карточка в ЭДО, задача во внешнем трекере, документ
          системы или своя ссылка. Можно добавить несколько.
        </p>
      )}

      {rows.map((row, index) => {
        const kind = ARTIFACT_KINDS.find((item) => item.value === row.kind) ?? ARTIFACT_KINDS[0];
        return (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <label className="field">
              <span className="sr-only">Вид артефакта</span>
              <select
                name="artifactKind"
                value={row.kind}
                onChange={(event) => update(index, { kind: event.target.value })}
                className="input w-48"
              >
                {ARTIFACT_KINDS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="sr-only">Подпись</span>
              <input
                name="artifactLabel"
                value={row.label}
                onChange={(event) => update(index, { label: event.target.value })}
                placeholder="Подпись, необязательно"
                className="input w-44"
              />
            </label>

            <label className="field flex-1">
              <span className="sr-only">Значение</span>
              {row.kind === "SYSTEM_DOC" ? (
                <select
                  name="artifactValue"
                  value={row.value}
                  onChange={(event) => update(index, { value: event.target.value })}
                  className="input w-full"
                >
                  <option value="">Выберите документ</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="artifactValue"
                  value={row.value}
                  onChange={(event) => update(index, { value: event.target.value })}
                  placeholder={kind.placeholder}
                  className="input w-full"
                />
              )}
            </label>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRows(rows.filter((_, position) => position !== index))}
            >
              Убрать
            </button>
          </div>
        );
      })}
    </div>
  );
}
