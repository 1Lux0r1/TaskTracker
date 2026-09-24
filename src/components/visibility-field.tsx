"use client";

import { VISIBILITY_OPTIONS, visibilityLabel, visibilityValue } from "@/lib/visibility";

type Props = {
  /** Текущее значение: у новой записи — значение по умолчанию для её вида. */
  value: boolean;
  /** Заведение записи: видимость задаёт любой сотрудник, и только сейчас. */
  isNew?: boolean;
  /** Администратор — единственный, кто меняет видимость после создания. */
  canChange?: boolean;
  className?: string;
};

/**
 * Видимость записи. При заведении её задаёт любой сотрудник, дальше поле
 * показывается только администратору: у участника его нет в форме, и сервер
 * присланное значение всё равно не применит.
 */
export function VisibilityField({ value, isNew = false, canChange = false, className }: Props) {
  if (!isNew && !canChange) {
    return (
      <div className={className}>
        <p className="text-sm font-medium text-gray-700">Видимость</p>
        <p className="mt-1 text-sm text-gray-900">{visibilityLabel(value)}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          После создания видимость меняет только администратор
        </p>
      </div>
    );
  }

  return (
    <label className={`field ${className ?? ""}`}>
      Видимость
      <select name="visibility" defaultValue={visibilityValue(value)} className="input">
        {VISIBILITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} — {option.note.toLowerCase()}
          </option>
        ))}
      </select>
      <span className="text-xs text-gray-500">
        {isNew
          ? "Задаётся один раз: дальше её меняет только администратор"
          : "Смена попадёт в журнал видимости"}
      </span>
    </label>
  );
}
