import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications-feed";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "TaskTracker — управление проектами",
  description: "Проекты, задачи, сроки и ответственные вместо Excel-таблиц",
};

const NAV_LINKS = [
  { href: "/", label: "Сегодня" },
  { href: "/projects", label: "Проекты" },
  { href: "/tasks", label: "Задачи" },
  { href: "/letters", label: "Переписка" },
  { href: "/documents", label: "Юридический трек" },
  { href: "/integrations", label: "Интеграции" },
  { href: "/meetings", label: "Встречи" },
  { href: "/calendar", label: "Календарь" },
  { href: "/reports", label: "Отчёты" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/directory", label: "Справочники" },
  { href: "/import", label: "Импорт" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  // Значок показывает только уже записанное: пересборку просрочек делает
  // страница уведомлений, иначе она шла бы на каждой странице системы.
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              TaskTracker
            </Link>
            {/* До входа меню не показываем: все разделы всё равно закрыты. */}
            {user && (
              <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
            {user && (
              <div className="ml-auto flex items-center gap-3 text-sm">
                <Link
                  href="/notifications"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  <BellIcon />
                  <span className="sr-only">Уведомления</span>
                  {unread > 0 && (
                    <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
                      {unread}
                    </span>
                  )}
                </Link>
                <Link href="/profile" className="text-gray-600 hover:text-gray-900">
                  {user.fullName}
                  {user.role === "ADMIN" && (
                    <span className="ml-2 rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                      админ
                    </span>
                  )}
                </Link>
                <form action={logout}>
                  <SubmitButton className="btn-secondary" pendingLabel="Выходим…">
                    Выйти
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        {/* Часто нужные справочники под рукой, остальные — в разделе. */}
        {user && (
          <footer className="border-t border-gray-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm text-gray-500">
              <Link href="/directory" className="hover:text-gray-900 hover:underline">
                Справочники:
              </Link>
              <Link href="/members" className="hover:text-gray-900 hover:underline">
                Сотрудники
              </Link>
              <Link href="/organizations" className="hover:text-gray-900 hover:underline">
                Организации
              </Link>
              <Link href="/org-contacts" className="hover:text-gray-900 hover:underline">
                Представители
              </Link>
              <Link href="/tracks" className="hover:text-gray-900 hover:underline">
                Треки работ
              </Link>
              <Link href="/reference" className="hover:text-gray-900 hover:underline">
                Справочная информация
              </Link>
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}

/** Колокол в шапке: рядом с ним число непрочитанного. */
function BellIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
