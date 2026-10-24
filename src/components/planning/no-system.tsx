import Link from "next/link";
import { loadPlanningSampleAction } from "@/app/actions/planning";
import { ActionForm } from "@/components/planning/action-form";
import { SubmitButton } from "@/components/submit-button";

/** Пока система не заведена, экранам модуля показывать нечего: три пути начать. */
export function NoSystem() {
  return (
    <div className="card p-6">
      <h2 className="font-display text-[15.5px] font-semibold text-gray-900">Планирование ещё пустое</h2>
      <p className="mt-1 text-sm text-gray-600">
        Загрузите книгу «Планирование развития системы» — справочники, дорожная карта и план работ лягут сразу. Или
        заведите систему руками в справочниках, или посмотрите модуль на тестовом примере.
      </p>
      <ActionForm action={loadPlanningSampleAction} className="mt-4 flex flex-wrap items-center gap-2">
        <Link href="/planning/book" className="btn-primary">
          Загрузить книгу
        </Link>
        <Link href="/planning/directory" className="btn-secondary">
          Завести в справочниках
        </Link>
        <SubmitButton className="btn-secondary" pendingLabel="Загружаем…">
          Тестовый пример
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
