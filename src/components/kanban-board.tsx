import Link from "next/link";
import { changeTaskStatus } from "@/app/actions/tasks";
import { DueTag, Pill, Who } from "@/components/ui";
import {
  BOARD_COLUMNS,
  isOverdue,
  isTaskOpen,
  plural,
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
  externalTaskKey?: string | null;
  assignee: { fullName: string } | null;
  track?: { name: string; color: string } | null;
  _count?: { attachments: number };
};

/**
 * Доска без drag-and-drop: перенос выполняется кнопками «←» и «→».
 * Это работает без JavaScript и на телефоне, где перетаскивание неудобно.
 * Карточка — как в макете: название, ключ внешнего трекера и файлы
 * пилюлями, внизу ответственный и срок; просроченная отмечена красной
 * полосой слева.
 */
export function KanbanBoard({ tasks }: { tasks: BoardTask[] }) {
  return (
    // Колонки в один ряд с прокруткой вбок — так доска устроена в макете.
    <div className="grid auto-cols-[272px] grid-flow-col gap-3.5 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column);
        return (
          <section key={column} className="flex flex-col rounded-xl bg-gray-100 p-[11px]">
            <header className="mb-[11px] flex items-center justify-between px-1">
              <h3 className="font-display text-[12.5px] font-semibold text-gray-600">
                {TASK_STATUS_LABELS[column]}
              </h3>
              <span className="font-mono text-[11.5px] text-gray-500">{columnTasks.length}</span>
            </header>

            {columnTasks.length === 0 && (
              <p className="mx-1 mt-1 mb-2 text-[13px] text-gray-500">Пусто</p>
            )}

            {columnTasks.map((task) => {
              const hot = isOverdue(task.dueDate, task.status);
              const files = task._count?.attachments ?? 0;
              return (
                <article
                  key={task.id}
                  className={`group relative mb-2 flex flex-col gap-[9px] rounded-[11px] border border-gray-200 bg-white p-3 hover:border-gray-300 ${
                    hot ? "border-l-[3px] border-l-red-600" : ""
                  }`}
                >
                  <Link
                    href={`/tasks/${task.id}`}
                    className="text-sm leading-snug text-gray-900 after:absolute after:inset-0 after:content-['']"
                  >
                    {task.title}
                  </Link>
                  {(task.externalTaskKey || files > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {task.externalTaskKey && <Pill>{task.externalTaskKey}</Pill>}
                      {files > 0 && (
                        <Pill>
                          {files} {plural(files, "файл", "файла", "файлов")}
                        </Pill>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Who name={task.assignee?.fullName} />
                    <DueTag date={task.dueDate} closed={!isTaskOpen(task.status)} />
                  </div>
                  <MoveControls taskId={task.id} status={column} />
                </article>
              );
            })}
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
    // Кнопки переноса видны при наведении: в покое карточка чистая, как в
    // макете, а статус всё равно меняется прямо с доски.
    <div className="relative z-10 flex gap-1.5 lg:hidden lg:group-focus-within:flex lg:group-hover:flex">
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
