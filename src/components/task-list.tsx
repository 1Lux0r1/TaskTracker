import Link from "next/link";
import { PriorityBadge, ProgressBar, StatusBadge, VisibilityBadge } from "@/components/badges";
import { TrackBadge } from "@/components/letter-badges";
import { formatDate, isOverdue } from "@/lib/domain";

export type TaskRow = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  progress: number;
  assignee: { fullName: string } | null;
  project: { id: string; code: string } | null;
  /** Ключ задачи во внешнем трекере: показываем под названием. */
  externalTaskKey?: string | null;
  /** Трек работ: запись справочника проекта, цвет её собственный. */
  track?: { name: string; color: string } | null;
  /** Служебная задача в отчёт руководству не идёт. */
  isPublic?: boolean;
};

type Props = {
  tasks: TaskRow[];
  /** Код проекта нужен только в сквозном списке задач. */
  showProject?: boolean;
  /** Отметки для смены видимости сразу пачке: только у администратора. */
  selectable?: boolean;
  emptyMessage?: string;
};

/**
 * Список задач строками, а не таблицей: в макете у записи своя строка
 * с названием, метками под ним и сроком справа — без колонки «№»,
 * без шапки таблицы и без рамок ячеек.
 */
export function TaskList({ tasks, showProject = false, selectable = false, emptyMessage }: Props) {
  if (tasks.length === 0) {
    return <p className="card p-6 text-sm text-gray-500">{emptyMessage ?? "Задач пока нет."}</p>;
  }

  return (
    <ul className="card divide-y divide-gray-200 overflow-hidden">
      {tasks.map((task) => {
        const overdue = isOverdue(task.dueDate, task.status);
        return (
          <li key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            {selectable && (
              <input
                type="checkbox"
                name="ids"
                value={task.id}
                className="size-4 flex-none"
                aria-label={`Отметить задачу «${task.title}»`}
              />
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`/tasks/${task.id}`}
                className="block truncate text-[14.5px] text-gray-900 hover:underline"
              >
                {task.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500">
                {showProject && task.project && (
                  <Link
                    href={`/projects/${task.project.id}`}
                    className="font-medium text-gray-600 hover:underline"
                  >
                    {task.project.code}
                  </Link>
                )}
                {task.track && <TrackBadge track={task.track} />}
                <PriorityBadge priority={task.priority} />
                <VisibilityBadge isPublic={task.isPublic ?? true} />
                {task.externalTaskKey && (
                  <span className="font-mono text-xs text-gray-400">{task.externalTaskKey}</span>
                )}
                <span>{task.assignee?.fullName ?? "без ответственного"}</span>
              </div>
            </div>

            <div className="hidden w-32 flex-none sm:block">
              <StatusBadge status={task.status} />
            </div>
            <div className="hidden w-24 flex-none md:block">
              <ProgressBar value={task.progress} />
            </div>
            <span
              className={`w-24 flex-none text-right font-mono text-[13px] tabular-nums ${
                overdue ? "font-medium text-red-600" : "text-gray-500"
              }`}
            >
              {formatDate(task.dueDate)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
