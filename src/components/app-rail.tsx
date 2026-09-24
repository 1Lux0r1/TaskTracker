"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type RailLink = {
  href: string;
  label: string;
  /** Число рядом с пунктом: сколько записей ждёт работы. */
  count?: number;
  /** Число выделяется красным, когда есть просроченное. */
  hot?: boolean;
};

export type RailGroup = {
  caption: string;
  links: RailLink[];
};

type Props = {
  groups: RailGroup[];
  project: { name: string; note: string } | null;
};

/**
 * Боковое меню из макета: логотип, переключатель проекта и пункты,
 * разложенные по группам. Текущий раздел подсвечивается, поэтому
 * компонент клиентский — иначе не узнать адрес страницы.
 */
export function AppRail({ groups, project }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 flex max-h-screen flex-col gap-5 self-start overflow-y-auto border-b border-gray-200 bg-white px-3.5 py-3 lg:h-screen lg:border-r lg:border-b-0 lg:px-3.5 lg:py-5">
      <div className="flex items-center gap-2.5 px-1.5">
        <span
          className="grid size-7 flex-none place-items-center rounded-lg text-[13px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--color-brand) 0%, #7b5cf0 100%)" }}
          aria-hidden
        >
          TT
        </span>
        <b className="font-display text-base font-bold tracking-tight">TaskTracker</b>
      </div>

      {project && (
        <Link
          href="/projects"
          className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 hover:border-gray-300"
        >
          <b className="font-display block text-[13.5px] leading-tight font-semibold">
            {project.name}
          </b>
          <span className="text-[11.5px] text-gray-500">{project.note}</span>
        </Link>
      )}

      <nav className="flex flex-col gap-5 lg:contents">
        {groups.map((group) => (
          <div key={group.caption} className="flex flex-col gap-0.5">
            <span className="rail-cap">{group.caption}</span>
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
                className="rail-link"
              >
                {link.label}
                {link.count !== undefined && link.count > 0 && (
                  <span className={link.hot ? "rail-count text-red-600" : "rail-count"}>
                    {link.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** «Сегодня» активно только на корне, остальные — вместе с вложенными адресами. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
