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
  /** Значок пункта из макета — простой символ, без картинок. */
  icon?: string;
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
    // На узком экране меню, как в макете, становится одной строкой с
    // прокруткой вбок: иначе список разделов занимает весь первый экран.
    <aside className="sticky top-0 z-20 flex items-center gap-3.5 overflow-x-auto border-b border-gray-200 bg-white px-4 py-3 lg:h-screen lg:max-h-screen lg:flex-col lg:items-stretch lg:gap-5 lg:self-start lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-3.5 lg:py-5">
      <div className="flex flex-none items-center gap-2.5 px-1.5">
        <span
          className="grid size-7 flex-none place-items-center rounded-lg text-[13px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--color-brand) 0%, #7b5cf0 100%)" }}
          aria-hidden
        >
          TT
        </span>
        <b className="font-display hidden text-base font-bold tracking-tight lg:inline">
          TaskTracker
        </b>
      </div>

      {project && (
        <Link
          href="/projects"
          className="flex-none rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 whitespace-nowrap hover:border-gray-300 lg:whitespace-normal"
        >
          <b className="font-display block text-[13.5px] leading-tight font-semibold">
            {project.name}
          </b>
          <span className="hidden text-[11.5px] text-gray-500 lg:inline">{project.note}</span>
        </Link>
      )}

      <nav className="flex flex-none gap-0.5 lg:contents">
        {groups.map((group) => (
          <div key={group.caption} className="flex gap-0.5 lg:flex-col">
            <span className="rail-cap hidden lg:block">{group.caption}</span>
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
                className="rail-link"
              >
                {link.icon && (
                  <span aria-hidden className="w-[17px] flex-none text-center text-sm opacity-85">
                    {link.icon}
                  </span>
                )}
                <span className="whitespace-nowrap lg:whitespace-normal">{link.label}</span>
                {link.count !== undefined && link.count > 0 && (
                  <span
                    className={`hidden lg:inline ${link.hot ? "rail-count font-semibold text-red-600" : "rail-count"}`}
                  >
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
