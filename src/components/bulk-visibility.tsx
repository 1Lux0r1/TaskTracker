"use client";

import { useState } from "react";
import { setVisibilityForMany } from "@/app/actions/visibility";
import { SubmitButton } from "@/components/submit-button";
import { plural } from "@/lib/domain";
import type { VisibilityEntity } from "@/lib/visibility";

type Props = {
  entity: VisibilityEntity;
  /** Пачкой меняет только администратор: у остальных реестр как был. */
  enabled?: boolean;
  /** Реестр целиком: строки с отметками лежат внутри этой же формы. */
  children: React.ReactNode;
};

/**
 * Смена видимости сразу пачке записей. Отметки живут прямо в реестре, а
 * панель появляется, когда отмечена хотя бы одна строка: пустая панель над
 * каждым реестром была бы шумом.
 */
export function BulkVisibility({ entity, enabled = true, children }: Props) {
  const [chosen, setChosen] = useState(0);

  if (!enabled) return <>{children}</>;

  function recount(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const boxes = form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked');
    setChosen(boxes.length);
  }

  return (
    <form action={setVisibilityForMany} onChange={recount}>
      <input type="hidden" name="entity" value={entity} />

      {chosen > 0 && (
        <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-3 shadow-sm">
          <span className="text-sm text-gray-700">
            Отмечено {chosen} {plural(chosen, "запись", "записи", "записей")}
          </span>
          <span className="ml-auto flex flex-wrap gap-2">
            <SubmitButton
              className="btn-secondary"
              pendingLabel="…"
              name="visibility"
              value="PUBLIC"
            >
              Сделать публичными
            </SubmitButton>
            <SubmitButton
              className="btn-secondary"
              pendingLabel="…"
              name="visibility"
              value="INTERNAL"
            >
              Сделать служебными
            </SubmitButton>
          </span>
        </div>
      )}

      {children}
    </form>
  );
}
