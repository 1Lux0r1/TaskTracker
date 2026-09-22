import {
  projectStatusLabel,
  taskPriorityLabel,
  taskStatusLabel,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain";

const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  NEW: "bg-blue-50 text-blue-700",
  BACKLOG: "bg-gray-100 text-gray-600",
  TODO: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  REVIEW: "bg-violet-50 text-violet-700",
  DONE: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-gray-100 text-gray-400 line-through",
};

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-sky-50 text-sky-700",
  HIGH: "bg-orange-50 text-orange-700",
  CRITICAL: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  const className = TASK_STATUS_CLASS[status as TaskStatus] ?? "bg-gray-100 text-gray-600";
  return <span className={`badge ${className}`}>{taskStatusLabel(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const className = PRIORITY_CLASS[priority as TaskPriority] ?? "bg-gray-100 text-gray-600";
  return <span className={`badge ${className}`}>{taskPriorityLabel(priority)}</span>;
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const className =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700"
      : status === "DONE"
        ? "bg-gray-100 text-gray-600"
        : status === "ON_HOLD"
          ? "bg-amber-50 text-amber-700"
          : status === "CANCELLED"
            ? "bg-red-50 text-red-700"
            : "bg-blue-50 text-blue-700";
  return <span className={`badge ${className}`}>{projectStatusLabel(status)}</span>;
}

/** Полоса выполнения: одинаково выглядит в таблице и на карточке задачи. */
export function ProgressBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
        <div
          className={percent === 100 ? "h-full bg-emerald-500" : "h-full bg-gray-900"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{percent}%</span>
    </div>
  );
}
