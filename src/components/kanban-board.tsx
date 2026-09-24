import Link from "next/link";
import { changeTaskStatus } from "@/app/actions/tasks";
import { PriorityBadge } from "@/components/badges";
import { TrackBadge } from "@/components/letter-badges";
import {
  BOARD_COLUMNS,
  formatDate,
  isOverdue,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/domain";

export type BoardTask = {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: { fullName: string } | null;
  track?: { name: string; color: string } | null;
};

/**
 * Доска без drag-and-drop: перенос выполняется кнопками «←» и «→».
 * Это работает без JavaScript и на телефоне, где перетаскивание неудобно.
 */
export function KanbanBoard({ tasks }: { tasks: BoardTask[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {BOARD_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column);
        return (
          <section key={column} className="card flex flex-col gap-2 bg-gray-50 p-3">
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{TASK_STATUS_LABELS[column]}</h3>
              <span className="badge bg-white text-gray-500">{columnTasks.length}</span>
            </header>

            {columnTasks.length === 0 && (
              <p className="px-1 py-4 text-xs text-gray-400">Пусто</p>
            )}

            {columnTasks.map((task) => (
              <article key={task.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <Link
                  href={`/tasks/${task.id}`}
                  className="block text-sm font-medium text-gray-900 hover:underline"
                >
                  {task.title}
                </Link>
                <p className="mt-1 text-xs text-gray-500">
                  {task.assignee?.fullName ?? "Без ответственного"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {task.track && <TrackBadge track={task.track} />}
                  <PriorityBadge priority={task.priority} />
                  {task.dueDate && (
                    <span
                      className={`text-xs tabular-nums ${
                        isOverdue(task.dueDate, task.status) ? "font-medium text-red-600" : "text-gray-500"
                      }`}
                    >
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
                <MoveControls taskId={task.id} status={column} />
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function MoveControls({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const index = BOARD_COLUMNS.indexOf(status);
  const previous = index > 0 ? BOARD_COLUMNS[index - 1] : null;
  const next = index < BOARD_COLUMNS.length - 1 ? BOARD_COLUMNS[index + 1] : null;

  return (
    <div className="mt-3 flex gap-2">
      {previous && (
        <form action={changeTaskStatus}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="status" value={previous} />
          <button
            type="submit"
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            title={`Вернуть в «${TASK_STATUS_LABELS[previous]}»`}
          >
            ←
          </button>
        </form>
      )}
      {next && (
        <form action={changeTaskStatus}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="status" value={next} />
          <button
            type="submit"
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            title={`Перенести в «${TASK_STATUS_LABELS[next]}»`}
          >
            → {TASK_STATUS_LABELS[next]}
          </button>
        </form>
      )}
    </div>
  );
}
