import Link from "next/link";
import { formatDate } from "@/lib/domain";

type Props = {
  task: {
    id: string;
    cipher: string;
    name: string;
    durationWeeks: number | null;
    startDate: Date | null;
    finishDate: Date | null;
    repeat: number;
    stage: { code: string; level: string };
  };
};

/** Строка задачи плана: шифр, наименование, этап и сроки. */
export function TaskLine({ task }: Props) {
  const tone =
    task.repeat > 1
      ? "bg-red-50 text-red-600"
      : task.stage.level === "MS"
        ? "bg-blue-50 text-blue-700"
        : "bg-purple-50 text-purple-600";
  return (
    <Link
      href={`/planning/tasks/${task.id}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-brand-soft"
    >
      <span className={`badge w-14 justify-center ${tone}`} title={task.repeat > 1 ? "Повтор (возврат)" : undefined}>
        {task.cipher.split(".").at(-1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-gray-900">{task.name}</span>
        <span className="block truncate font-mono text-[12px] text-gray-500">{task.cipher}</span>
      </span>
      <span className="text-[12.5px] whitespace-nowrap text-gray-600 tabular-nums">
        {task.startDate ? `${formatDate(task.startDate)} – ${formatDate(task.finishDate)}` : "сроки не заданы"}
        {task.durationWeeks ? ` · ${task.durationWeeks} нед.` : ""}
      </span>
    </Link>
  );
}
