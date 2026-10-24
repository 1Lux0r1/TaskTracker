"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/planning", label: "Направления" },
  { href: "/planning/roadmap", label: "Дорожная карта" },
  { href: "/planning/calculator", label: "Калькулятор шифра" },
  { href: "/planning/plan", label: "План работ" },
  { href: "/planning/grid", label: "Решётка" },
  { href: "/planning/directory", label: "Справочники" },
];

/** Переключатель экранов модуля. Карточки ДК и задач живут под своими вкладками. */
export function PlanningTabs() {
  const pathname = usePathname();
  const current = (href: string) => {
    if (href === "/planning") return pathname === "/planning" || pathname.startsWith("/planning/directions");
    if (href === "/planning/roadmap") return pathname.startsWith(href) || pathname.startsWith("/planning/dk");
    if (href === "/planning/plan") return pathname.startsWith(href) || pathname.startsWith("/planning/tasks/");
    return pathname.startsWith(href);
  };

  return (
    <nav className="seg flex-wrap" aria-label="Экраны планирования">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={current(tab.href) ? "page" : undefined}
          className="seg-btn"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
