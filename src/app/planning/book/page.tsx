import { BookImport } from "@/components/planning/book-import";

export const dynamic = "force-dynamic";

/**
 * Загрузка книги «Планирование развития системы»: проверка с замечаниями и
 * запись тем же файлом. То же умеет команда npm run planning:import.
 */
export default function PlanningBookPage() {
  return <BookImport />;
}
