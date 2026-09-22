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
}: Props) {
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <form className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* На узком экране строка поиска занимает свой ряд: иначе кнопки
            сжимают её до нечитаемой ширины. */}
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1">
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
            name="q"
            defaultValue={query}
            placeholder={placeholder}
            className="input w-full pl-9"
            aria-label="Поиск"
          />
        </div>

        <button type="submit" className="btn-primary">
          Найти
        </button>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
            activeCount > 0
              ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
              : "border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Фильтры
          {activeCount > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 text-xs tabular-nums">
              {activeCount}
            </span>
          )}
          <span aria-hidden="true" className="text-xs">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {activeCount > 0 && (
          <Link href={resetHref} className="text-sm text-gray-600 hover:underline">
            Сбросить
          </Link>
        )}
      </div>

      {/* Панель скрыта, а не размонтирована: иначе браузер не отправил бы
          заданные в ней значения вместе с поиском. */}
      <div className={open ? "space-y-3 border-t border-gray-100 pt-3" : "hidden"}>
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
