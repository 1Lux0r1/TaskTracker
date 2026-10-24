"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  /** Скрытые поля формы: например, имя копии. */
  fields?: Record<string, string>;
  /** Вопрос перед действием, которое меняет данные у всех. */
  confirm?: { question: string; label: string };
};

/** Кнопка обслуживания: делает дело и показывает рядом, чем кончилось. */
export function MaintenanceAction({
  action,
  children,
  pendingLabel,
  className = "btn-primary",
  fields = {},
  confirm,
}: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {confirm ? (
        <ConfirmSubmit
          className={className}
          question={confirm.question}
          confirmLabel={confirm.label}
          pendingLabel={pendingLabel}
        >
          {children}
        </ConfirmSubmit>
      ) : (
        <SubmitButton className={className} pendingLabel={pendingLabel}>
          {children}
        </SubmitButton>
      )}
      {state && !state.ok && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
