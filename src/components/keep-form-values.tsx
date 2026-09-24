"use client";

import { useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/validation";

type Props = { state: ActionResult | null };

/**
 * React очищает форму после серверного действия — возвращает поля к их
 * исходным значениям. Для формы, которая ответила ошибкой, это значит
 * потерянный ввод: человек заполнил десяток полей, ошибся в одном и получил
 * пустую форму. Поэтому перед отправкой запоминаем введённое и возвращаем
 * его на место, когда действие ответило отказом.
 *
 * Ставится внутрь формы; своего имени у поля нет, поэтому в FormData оно
 * не попадает.
 */
export function KeepFormValues({ state }: Props) {
  const anchor = useRef<HTMLInputElement>(null);
  const typed = useRef<[string, string][] | null>(null);
  const handled = useRef<ActionResult | null>(null);

  useEffect(() => {
    const form = anchor.current?.form;
    if (!form) return;

    const remember = () => {
      typed.current = [...new FormData(form)].filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      );
    };

    form.addEventListener("submit", remember);
    return () => form.removeEventListener("submit", remember);
  }, []);

  useEffect(() => {
    if (!state || state.ok || handled.current === state) return;
    handled.current = state;

    const form = anchor.current?.form;
    const values = typed.current;
    if (form && values) restore(form, values);
  }, [state]);

  return <input ref={anchor} type="hidden" />;
}

function restore(form: HTMLFormElement, values: [string, string][]): void {
  const byName = new Map<string, string[]>();
  for (const [name, value] of values) {
    byName.set(name, [...(byName.get(name) ?? []), value]);
  }

  // Повторяющиеся поля (участники встречи, стороны подписания) идут по
  // порядку, поэтому считаем, сколько значений уже разобрано под этим именем.
  const used = new Map<string, number>();

  for (const element of form.elements) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      continue;
    }
    if (!element.name) continue;

    const list = byName.get(element.name);

    if (element instanceof HTMLInputElement) {
      // Файл вернуть нельзя: его выбирают заново.
      if (element.type === "file") continue;
      if (element.type === "checkbox" || element.type === "radio") {
        element.checked = list?.includes(element.value) ?? false;
        continue;
      }
    }

    if (!list) continue;
    const index = used.get(element.name) ?? 0;
    if (index >= list.length) continue;
    element.value = list[index];
    used.set(element.name, index + 1);
  }
}
