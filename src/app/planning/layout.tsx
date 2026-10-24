import Link from "next/link";
import { PlanningTabs } from "@/components/planning/planning-tabs";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Планирование развития — TaskTracker" };

/**
 * Модуль «Планирование развития»: методика из книги планирования перенесена
 * в систему. Шесть экранов переключаются вкладками сверху.
 */
export default async function PlanningLayout({ children }: LayoutProps<"/planning">) {
  await requireUser();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            Планирование развития
          </h1>
          <p className="mt-1 max-w-[70ch] text-sm text-gray-600">
            Система → направление → блок → ДК → задачи плана. Шифр собирает система из
            выбранных значений.
          </p>
        </div>
        <Link href="/planning/book" className="btn-secondary">
          Загрузить книгу
        </Link>
      </div>
      <div className="mb-5">
        <PlanningTabs />
      </div>
      {children}
    </div>
  );
}
