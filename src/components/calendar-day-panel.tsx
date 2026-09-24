import Link from "next/link";

export type DayPanelEvent = {
  id: string;
  href: string;
  label: string;
  note: string;
  /** Цвет метки: он же различает виды записей в сетке календаря. */
  dot: string;
  overdue: boolean;
};

type Props = {
  title: string;
  /** День недели и насколько этот день далеко от сегодняшнего. */
  note: string;
  /** День в виде ГГГГ-ММ-ДД: уходит в формы заведения записей. */
  day: string;
  projectId: string;
  events: DayPanelEvent[];
};

/**
 * Панель выбранного дня: что на него приходится и чем этот день пополнить.
 * Кнопки ведут в обычные формы с уже подставленной датой — отдельного
 * быстрого создания нет, чтобы запись заводилась со всеми реквизитами.
 */
export function CalendarDayPanel({ title, note, day, projectId, events }: Props) {
  // Из календаря форма открывается окном посередине, а не панелью справа.
  const project = projectId ? `&projectId=${projectId}` : "";
  const as = `&panel=modal${project}`;

  return (
    <aside className="card h-fit overflow-hidden lg:sticky lg:top-20">
      <div className="border-b border-gray-200 px-4.5 py-4">
        <b className="font-display block text-base font-semibold text-gray-900">{title}</b>
        <span className="text-xs text-gray-500">{note}</span>
      </div>

      {events.length > 0 ? (
        <ul>
          {events.map((event) => (
            <li key={event.id} className="border-b border-gray-200 last:border-b-0">
              <Link href={event.href} className="flex items-center gap-3 px-4.5 py-3 hover:bg-gray-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-gray-900">{event.label}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                    <span
                      aria-hidden
                      className="size-2 flex-none rounded-[2px]"
                      style={{ background: event.dot }}
                    />
                    <span className="truncate">{event.note}</span>
                  </span>
                </span>
                {event.overdue && (
                  <span className="flex-none text-xs font-medium text-red-600">просрочено</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4.5 py-4 text-sm text-gray-500">На этот день ничего не назначено.</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-gray-200 px-4.5 py-3.5">
        <Link href={`/tasks/new?dueDate=${day}${as}`} className="btn-secondary px-2.5 py-1">
          Задача
        </Link>
        <Link href={`/meetings/new?date=${day}${as}`} className="btn-secondary px-2.5 py-1">
          Встреча
        </Link>
        <Link href={`/letters/new?dueDate=${day}${as}`} className="btn-secondary px-2.5 py-1">
          Письмо
        </Link>
      </div>
    </aside>
  );
}
