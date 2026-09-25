import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppRail, type RailGroup } from "@/components/app-rail";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CLOSED_LETTER_STATUSES, CLOSED_TASK_STATUSES } from "@/lib/domain";
import { unreadCount } from "@/lib/notifications-feed";
import "./globals.css";

// Три шрифта из макета: заголовки, текст и цифры.
const display = Manrope({
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin", "cyrillic"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin", "cyrillic"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono-code",
  weight: ["400", "500"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "TaskTracker — управление проектами",
  description: "Проекты, задачи, сроки и ответственные вместо Excel-таблиц",
};

export default async function RootLayout({ children, panel }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  // Значок показывает только уже записанное: пересборку просрочек делает
  // страница уведомлений, иначе она шла бы на каждой странице системы.
  const unread = user ? await unreadCount(user.id) : 0;
  const rail = user ? await railData() : null;

  return (
    <html
      lang="ru"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        {/* До входа оболочка не нужна: все разделы всё равно закрыты. */}
        {user ? (
          <div className="lg:grid lg:min-h-screen lg:grid-cols-[230px_minmax(0,1fr)]">
            <AppRail groups={rail?.groups ?? []} project={rail?.project ?? null} />
            <div className="flex min-w-0 flex-col">
              <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white/85 px-4 py-2.5 backdrop-blur lg:px-6">
                <form action="/search" className="min-w-52 flex-1 lg:max-w-lg">
                  <label className="relative flex items-center">
                    <span className="sr-only">Поиск по задачам, письмам и документам</span>
                    <SearchIcon />
                    <input
                      type="search"
                      name="q"
                      placeholder="Поиск по задачам, письмам и документам"
                      className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pr-3 pl-9 text-sm text-gray-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </label>
                </form>
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
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <span className="bg-brand-soft text-brand font-display grid size-6 flex-none place-items-center rounded-full text-[10px] font-semibold">
                      {initials(user.fullName)}
                    </span>
                    {user.fullName}
                    {user.role === "ADMIN" && (
                      <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
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
              </header>
              <main className="w-full max-w-[1240px] flex-1 px-4 py-6 lg:px-6">{children}</main>
              {/* Формы заведения записей: панель справа, из календаря — окно. */}
              {panel}
            </div>
          </div>
        ) : (
          <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
        )}
      </body>
    </html>
  );
}

/**
 * Числа у пунктов меню: сколько записей ждёт работы. Считаем по всем
 * проектам — боковое меню общее, а проект выбирается уже внутри раздела.
 */
async function railData(): Promise<{
  groups: RailGroup[];
  project: { name: string; note: string } | null;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    openTasks,
    overdueTasks,
    openLetters,
    overdueLetters,
    signingDocuments,
    aheadMeetings,
    projects,
    members,
  ] = await Promise.all([
      prisma.task.count({ where: { status: { notIn: CLOSED_TASK_STATUSES } } }),
      prisma.task.count({
        where: { status: { notIn: CLOSED_TASK_STATUSES }, dueDate: { lt: today } },
      }),
      prisma.letter.count({ where: { status: { notIn: CLOSED_LETTER_STATUSES } } }),
      prisma.letter.count({
        where: { status: { notIn: CLOSED_LETTER_STATUSES }, dueDate: { lt: today } },
      }),
      prisma.document.count({ where: { status: { in: ["SENT", "SIGNING", "REVIEW"] } } }),
      prisma.meeting.count({ where: { date: { gte: today } } }),
      prisma.project.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: { name: true },
      }),
      prisma.member.count({ where: { isActive: true } }),
    ]);

  const groups: RailGroup[] = [
    {
      caption: "Работа",
      links: [
        { href: "/", label: "Сегодня", icon: "target" },
        { href: "/tasks", label: "Задачи", icon: "task", count: openTasks, hot: overdueTasks > 0 },
        {
          href: "/letters",
          label: "Реестр писем ЭДО",
          icon: "mail",
          count: openLetters,
          hot: overdueLetters > 0,
        },
        { href: "/documents", label: "Юридический трек", icon: "pen", count: signingDocuments },
        { href: "/integrations", label: "Интеграции", icon: "swap" },
        { href: "/meetings", label: "Встречи", icon: "users", count: aheadMeetings },
        { href: "/calendar", label: "Календарь", icon: "calendar" },
      ],
    },
    {
      caption: "Сводка",
      links: [
        { href: "/analytics", label: "Аналитика", icon: "chart" },
        { href: "/reports", label: "Отчёты", icon: "file" },
        { href: "/directory", label: "Справочники", icon: "book" },
        { href: "/import", label: "Импорт", icon: "download" },
      ],
    },
  ];

  const project = projects[0]
    ? {
        name: projects[0].name,
        note:
          projects.length > 1
            ? `Проектов: ${projects.length} · участников: ${members}`
            : `Участников: ${members}`,
      }
    : null;

  return { groups, project };
}

/** Инициалы для кружка рядом с именем. */
function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

/** Лупа в строке поиска. */
function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 text-gray-500"
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
