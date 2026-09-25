"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  /** Куда ведёт «Сбросить»: адрес реестра без параметров. */
  resetHref: string;
  /** Сколько условий задано сверх выборки по умолчанию. */
  activeCount: number;
  /** Текущий поисковый запрос. */
  query: string;
  placeholder?: string;
  /** Поля, которые прячутся под кнопкой «Фильтры». */
  children: React.ReactNode;
  /** Сохранённые наборы: список живёт сверху той же панели. */
  presets?: React.ReactNode;
  /** Применённый набор: его видно сразу, и снимается он одной ссылкой. */
  applied?: { name: string; resetHref: string } | null;
  /** Сколько нашлось — справа от кнопок, как в макете. */
  found?: React.ReactNode;
};

/**
 * Один вид для всех реестров: поисковая строка на виду, остальные условия —
 * под кнопкой «Фильтры» со счётчиком. Панель раскрыта, если условия уже
 * заданы: иначе непонятно, почему список короткий.
 */
export function FilterBar({
  resetHref,
  activeCount,
  query,
  placeholder = "номер, тема, организация",
  children,
  presets,
  applied = null,
  found,
}: Props) {
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <form className="space-y-3">
      {/* Кнопка по умолчанию для Enter в строке поиска. */}
      <button type="submit" className="sr-only" tabIndex={-1}>
        Найти
      </button>
      <div className="flex flex-wrap items-center gap-2.5">
        {/* На узком экране строка поиска занимает свой ряд: иначе кнопки
            сжимают её до нечитаемой ширины. Отдельной кнопки «Найти» нет,
            как в макете: поиск запускается клавишей Enter. */}
        <div className="relative w-full min-w-0 sm:w-auto sm:max-w-[420px] sm:min-w-[220px] sm:flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
          >
            <path
              fill="currentColor"
              d="M9 3a6 6 0 1 0 3.47 10.9l3.31 3.32a1 1 0 0 0 1.42-1.42l-3.32-3.31A6 6 0 0 0 9 3Zm-4 6a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
            />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={placeholder}
            className="w-full rounded-[11px] border border-gray-200 bg-white py-[9px] pr-3.5 pl-9 text-sm text-gray-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            aria-label="Поиск"
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-pressed={activeCount > 0}
          className={`inline-flex items-center gap-2 rounded-[11px] border px-[15px] py-[9px] text-sm transition ${
            activeCount > 0
              ? "border-brand bg-brand-soft font-medium text-brand"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
          }`}
        >
          Фильтры
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-[7px] py-px font-mono text-[11.5px] text-white">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <Link href={resetHref} className="text-sm text-gray-600 hover:underline">
            Сбросить
          </Link>
        )}

        {found !== undefined && (
          <span className="ml-auto text-[13px] text-gray-500">{found}</span>
        )}
      </div>

      {/* Применённый набор виден рядом с поиском: иначе человек решит, что
          часть записей пропала. */}
      {applied && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs text-white">
            Набор «{applied.name}»
          </span>
          <Link href={applied.resetHref} className="text-gray-600 hover:underline">
            Показать без набора
          </Link>
        </p>
      )}

      {/* Панель скрыта, а не размонтирована: иначе браузер не отправил бы
          заданные в ней значения вместе с поиском. */}
      <div className={open ? "card space-y-3 px-4 py-3.5" : "hidden"}>
        {presets}
        {/* Сетка, а не строка: подпись встаёт над полем, как в остальных
            формах, и поля выстраиваются ровными рядами. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
        <button type="submit" className="btn-secondary">
          Показать
        </button>
      </div>
    </form>
  );
}
