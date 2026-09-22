import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
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
  { href: "/", label: "Сводка" },
  { href: "/projects", label: "Проекты" },
  { href: "/tasks", label: "Задачи" },
  { href: "/letters", label: "Переписка" },
  { href: "/documents", label: "Документы" },
  { href: "/calendar", label: "Календарь" },
  { href: "/reports", label: "Отчёты" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/members", label: "Сотрудники" },
  { href: "/import", label: "Импорт" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

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
        {/* Справочник организаций служебный: им пользуются при импорте и при
            настройке сторон подписания, поэтому он живёт не в меню, а здесь. */}
        {user && (
          <footer className="border-t border-gray-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm text-gray-500">
              <span>Справочники:</span>
              <Link href="/organizations" className="hover:text-gray-900 hover:underline">
                Организации
              </Link>
              <Link href="/tracks" className="hover:text-gray-900 hover:underline">
                Треки работ
              </Link>
            </div>
          </footer>
        )}
      </body>
    </html>
  );
}
