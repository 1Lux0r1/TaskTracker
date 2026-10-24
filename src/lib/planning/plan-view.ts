/**
 * Что показывает план работ за период: блоки → ДК → задачи, отобранные
 * поиском и периодом. Один отбор на экран и на выгрузку в Excel.
 */
import { overlapsPeriod } from "./period";
import { type PlanTree, blockCipher, dkCipher, sortTasks } from "./queries";

/** Самая ранняя и самая поздняя дата задач плана — для «Весь план». */
export function planSpan(directions: PlanTree): { from: Date; to: Date } | null {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const direction of directions) {
    for (const part of direction.parts) {
      for (const dk of part.dks) {
        for (const task of dk.tasks) {
          if (task.startDate && (!from || task.startDate < from)) from = task.startDate;
          if (task.finishDate && (!to || task.finishDate > to)) to = task.finishDate;
        }
      }
    }
  }
  return from && to ? { from, to } : null;
}

/**
 * Отбор плана. Поиск — по шифру и наименованию задачи и по коду ДК. Период
 * оставляет задачи, задевающие его хотя бы днём, и задачи без сроков: их
 * надо видеть, чтобы назначить сроки. ДК, все задачи которого вне отбора,
 * скрывается; ДК совсем без задач виден, пока нет поиска, — это пробел в
 * плане. Блок без видимых ДК скрывается.
 */
export function planView(
  directions: PlanTree,
  options: { q: string; period: { from: Date; to: Date } },
) {
  const { q, period } = options;
  return directions
    .flatMap((direction) =>
      direction.parts.map((part) => ({
        direction,
        part,
        code: blockCipher(direction, part),
        dks: part.dks
          .map((dk) => {
            const code = dkCipher(direction, part, dk);
            const tasks = sortTasks(dk.tasks).filter(
              (task) =>
                (!q || task.searchIndex?.includes(q) || code.toLowerCase().includes(q)) &&
                (!task.startDate || !task.finishDate || overlapsPeriod(task, period)),
            );
            return { dk, code, tasks };
          })
          .filter((item) => item.tasks.length > 0 || (!q && item.dk.tasks.length === 0)),
      })),
    )
    .filter((block) => block.dks.length > 0);
}

export type PlanViewBlock = ReturnType<typeof planView>[number];
export type PlanViewDk = PlanViewBlock["dks"][number];
export type PlanViewTask = PlanViewDk["tasks"][number];

/** Цвет полосы задачи — тот же смысл на экране и в Excel. */
export function taskTone(task: { repeat: number; module: unknown }): "repeat" | "ms" | "dk" {
  if (task.repeat > 1) return "repeat";
  return task.module ? "ms" : "dk";
}

/** Срок ДК на диаграмме: от первой задачи до последней. */
export function dkSpan(tasks: { startDate: Date | null; finishDate: Date | null }[]): { from: Date; to: Date } | null {
  const starts = tasks.flatMap((task) => (task.startDate ? [task.startDate.getTime()] : []));
  const finishes = tasks.flatMap((task) => (task.finishDate ? [task.finishDate.getTime()] : []));
  if (!starts.length || !finishes.length) return null;
  return { from: new Date(Math.min(...starts)), to: new Date(Math.max(...finishes)) };
}
