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
  /** Колонка проекта нужна только в сквозном списке задач. */
  showProject?: boolean;
  emptyMessage?: string;
};

export function TaskTable({ tasks, showProject = false, emptyMessage }: Props) {
  if (tasks.length === 0) {
    return (
      <p className="card p-6 text-sm text-gray-500">
        {emptyMessage ?? "Задач пока нет."}
      </p>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="table-head w-20">№</th>
            {showProject && <th className="table-head w-24">Проект</th>}
            <th className="table-head">Задача</th>
            <th className="table-head w-36">Статус</th>
            <th className="table-head w-28">Приоритет</th>
            <th className="table-head w-44">Ответственный</th>
            <th className="table-head w-28">Срок</th>
            <th className="table-head w-36">Готовность</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueDate, task.status);
            return (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="table-cell text-gray-400 tabular-nums">{task.number}</td>
                {showProject && (
                  <td className="table-cell">
                    {task.project ? (
                      <Link
                        href={`/projects/${task.project.id}`}
                        className="font-medium text-gray-700 hover:underline"
                      >
                        {task.project.code}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="table-cell">
                  <Link href={`/tasks/${task.id}`} className="font-medium text-gray-900 hover:underline">
                    {task.title}
                  </Link>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    {task.track && <TrackBadge track={task.track} />}
                    <VisibilityBadge isPublic={task.isPublic ?? true} />
                    {task.externalTaskKey && (
                      <span className="font-mono text-xs text-gray-400">{task.externalTaskKey}</span>
                    )}
                  </span>
                </td>
                <td className="table-cell">
                  <StatusBadge status={task.status} />
                </td>
                <td className="table-cell">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="table-cell">{task.assignee?.fullName ?? "—"}</td>
                <td className={`table-cell tabular-nums ${overdue ? "font-medium text-red-600" : ""}`}>
                  {formatDate(task.dueDate)}
                </td>
                <td className="table-cell">
                  <ProgressBar value={task.progress} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
