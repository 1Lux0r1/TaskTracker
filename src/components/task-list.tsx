import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { DueTag, Who } from "@/components/ui";
import { isTaskOpen, taskPriorityLabel } from "@/lib/domain";

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
 * с названием и метками под ним, справа ответственный, статус и срок —
 * без колонки «№», без шапки таблицы и без рамок ячеек.
 */
export function TaskList({ tasks, showProject = false, selectable = false, emptyMessage }: Props) {
  if (tasks.length === 0) {
    return <p className="card p-6 text-sm text-gray-500">{emptyMessage ?? "Задач пока нет."}</p>;
  }

  return (
    <ul className="card overflow-hidden">
      {tasks.map((task) => {
        const open = isTaskOpen(task.status);
        const urgent = task.priority === "HIGH" || task.priority === "CRITICAL";
        return (
          <li
            key={task.id}
            className="relative flex items-center gap-3.5 border-b border-gray-200 px-4 py-[13px] last:border-b-0 hover:bg-gray-100"
          >
            {selectable && (
              <input
                type="checkbox"
                name="ids"
                value={task.id}
                className="relative z-10 size-4 flex-none"
                aria-label={`Отметить задачу «${task.title}»`}
              />
            )}

            <div className="min-w-0 flex-1">
              <Link
                href={`/tasks/${task.id}`}
                className={`block truncate text-[14.5px] leading-snug after:absolute after:inset-0 after:content-[''] ${
                  open ? "text-gray-900" : "text-gray-500 line-through"
                }`}
              >
                {task.title}
              </Link>
              <p className="mt-[3px] flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-gray-500">
                {[
                  showProject && task.project ? task.project.code : null,
                  task.track?.name,
                  task.externalTaskKey,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {urgent && (
                  <span className="text-red-600">· {taskPriorityLabel(task.priority)}</span>
                )}
                {task.isPublic === false && <span>· служебная</span>}
              </p>
            </div>

            <div className="hidden flex-none items-center gap-2.5 sm:grid sm:grid-cols-[170px_128px_84px]">
              <Who name={task.assignee?.fullName} />
              <span>
                <StatusBadge status={task.status} />
              </span>
              <span className="justify-self-end">
                <DueTag date={task.dueDate} closed={!open} />
              </span>
            </div>
            <span className="flex-none sm:hidden">
              <DueTag date={task.dueDate} closed={!open} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
