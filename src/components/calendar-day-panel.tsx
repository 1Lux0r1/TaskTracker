import Link from "next/link";

export type DayPanelEvent = {
  id: string;
  href: string;
  label: string;
  note: string;
  chip: string;
  type: string;
};

type Props = {
  title: string;
  isToday: boolean;
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
export function CalendarDayPanel({ title, isToday, day, projectId, events }: Props) {
  const project = projectId ? `&projectId=${projectId}` : "";

  return (
    <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-4">
      <div>
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
          {title}
          {isToday && <span className="badge bg-gray-900 text-white">сегодня</span>}
        </h2>
        <p className="text-sm text-gray-500">
          {events.length === 0 ? "На этот день ничего не назначено" : `Записей: ${events.length}`}
        </p>
      </div>

      {events.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {events.map((event) => (
            <li key={event.id} className="py-2">
              <Link href={event.href} className="block">
                <span className={`badge ${event.chip}`}>{event.type}</span>
                <span className="mt-1 block text-sm text-gray-900 hover:underline">
                  {event.label}
                </span>
                {event.note && <span className="block text-sm text-gray-500">{event.note}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500">Завести на этот день</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={`/tasks/new?dueDate=${day}${project}`} className="btn-secondary">
            Задача
          </Link>
          <Link href={`/meetings/new?date=${day}${project}`} className="btn-secondary">
            Встреча
          </Link>
          <Link href={`/letters/new?dueDate=${day}${project}`} className="btn-secondary">
            Письмо
          </Link>
        </div>
      </div>
    </aside>
  );
}
