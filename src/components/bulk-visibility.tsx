"use client";

import { useRef, useState } from "react";
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
 * «Выбрать все» берёт то, что показано: вместе с фильтрами это и даёт
 * «все письма проекта» в два действия, ради чего всё и затевалось.
 */
export function BulkVisibility({ entity, enabled = true, children }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [chosen, setChosen] = useState(0);

  if (!enabled) return <>{children}</>;

  function boxes(): HTMLInputElement[] {
    return Array.from(form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? []);
  }

  function recount() {
    setChosen(boxes().filter((box) => box.checked).length);
  }

  function toggleAll(event: React.ChangeEvent<HTMLInputElement>) {
    const checked = event.currentTarget.checked;
    for (const box of boxes()) box.checked = checked;
  }

  // Отметки снимает сама React, когда действие отработало; счётчик должен
  // уйти вместе с ними, иначе панель висит с «Отмечено 2» при нуле.
  async function submit(formData: FormData) {
    await setVisibilityForMany(formData);
    setChosen(0);
  }

  return (
    <form ref={form} action={submit} onChange={recount}>
      <input type="hidden" name="entity" value={entity} />

      <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="size-4" onChange={toggleAll} />
          Выбрать все показанные
        </label>

        {chosen > 0 ? (
          <>
            <span className="text-sm text-gray-500">
              отмечено {chosen} {plural(chosen, "запись", "записи", "записей")}
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
          </>
        ) : (
          <span className="text-sm text-gray-400">
            отметьте записи, чтобы сменить видимость сразу нескольким
          </span>
        )}
      </div>

      {children}
    </form>
  );
}
