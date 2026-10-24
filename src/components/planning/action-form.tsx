"use client";

import { useActionState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
};

/**
 * Форма модуля планирования: отправляет серверное действие и показывает его
 * ответ над полями. Поля приходят снаружи, поэтому одна обёртка служит и
 * строке справочника, и карточке направления.
 */
export function ActionForm({ action, children, className }: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      <KeepFormValues state={state} />
      {state && !state.ok && (
        <p role="alert" className="mb-2 w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p className="mb-2 w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}
      {children}
    </form>
  );
}
