"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  /** Поле и значение кнопки: одна форма с несколькими действиями. */
  name?: string;
  value?: string;
};

/** Кнопка отправки формы, которая сама блокируется на время server action. */
export function SubmitButton({
  children,
  className = "btn-primary",
  pendingLabel,
  name,
  value,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending}>
      {pending ? (pendingLabel ?? "Сохраняем…") : children}
    </button>
  );
}
