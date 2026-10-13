import Link from "next/link";

/** Пока система не заведена, экранам модуля показывать нечего. */
export function NoSystem() {
  return (
    <p className="card p-6 text-sm text-gray-600">
      Система для планирования ещё не заведена. Заведите её в{" "}
      <Link href="/planning/directory" className="font-medium text-brand hover:underline">
        справочниках модуля
      </Link>{" "}
      или загрузите тестовый пример командой <code className="font-mono">npm run planning:sample</code>.
    </p>
  );
}
