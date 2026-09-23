"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  /** Подпись кнопки до подтверждения: «Удалить задачу». */
  children: React.ReactNode;
  /** Вопрос рядом с подтверждением. */
  question?: string;
  /** Подпись кнопки, которая действительно отправляет форму. */
  confirmLabel?: string;
  pendingLabel?: string;
  className?: string;
};

/**
 * Удаление в два шага: первое нажатие спрашивает, второе удаляет, рядом
 * всегда есть «Отмена». Так удаление нельзя запустить случайным попаданием
 * по кнопке, а отказаться можно до того, как запись пропала.
 */
export function ConfirmSubmit({
  children,
  question = "Точно удалить?",
  confirmLabel = "Да, удалить",
  pendingLabel = "Удаляем…",
  className = "btn-danger",
}: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-900">{question}</span>
      <SubmitButton className={className} pendingLabel={pendingLabel}>
        {confirmLabel}
      </SubmitButton>
      <button type="button" className="btn-secondary" onClick={() => setAsking(false)}>
        Отмена
      </button>
    </span>
  );
}
