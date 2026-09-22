"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
};

/** Кнопка отправки формы, которая сама блокируется на время server action. */
export function SubmitButton({ children, className = "btn-primary", pendingLabel }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingLabel ?? "Сохраняем…") : children}
    </button>
  );
}
