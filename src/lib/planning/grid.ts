/**
 * Решётка: две матрицы плана — «подсистемы × блоки» и «МС × блоки». Счёт
 * отдельно от экрана, чтобы его можно было проверить тестом.
 */

export type GridDk = {
  id: string;
  blockKey: string;
  subsystemId: string | null;
};

export type GridTask = {
  dkId: string;
  blockKey: string;
  moduleId: string | null;
  /** Подсистема МС задачи. */
  moduleSubsystemId: string | null;
};

export type GridCounts = Map<string, Map<string, number>>;

/**
 * Подсистема задачи: у задачи по МС — подсистема МС, у задачи по ДК —
 * подсистема ДК.
 */
function taskSubsystem(task: GridTask, dkSubsystem: Map<string, string | null>): string | null {
  return task.moduleSubsystemId ?? dkSubsystem.get(task.dkId) ?? null;
}

function bump(counts: GridCounts, row: string, column: string): void {
  const line = counts.get(row) ?? new Map<string, number>();
  line.set(column, (line.get(column) ?? 0) + 1);
  counts.set(row, line);
}

/** Подсистемы × блоки, число задач. */
export function subsystemTaskCounts(dks: GridDk[], tasks: GridTask[]): GridCounts {
  const dkSubsystem = new Map(dks.map((dk) => [dk.id, dk.subsystemId]));
  const counts: GridCounts = new Map();
  for (const task of tasks) {
    const subsystem = taskSubsystem(task, dkSubsystem);
    if (subsystem) bump(counts, subsystem, task.blockKey);
  }
  return counts;
}

/**
 * Подсистемы × блоки, число ДК. ДК задевает подсистему, если она указана у
 * ДК или в ней лежит МС одной из задач ДК; каждый ДК считается один раз.
 */
export function subsystemDkCounts(dks: GridDk[], tasks: GridTask[]): GridCounts {
  const touched = new Map<string, Set<string>>();
  const blockOf = new Map(dks.map((dk) => [dk.id, dk.blockKey]));
  const add = (dkId: string, subsystem: string | null) => {
    if (!subsystem) return;
    const set = touched.get(dkId) ?? new Set<string>();
    set.add(subsystem);
    touched.set(dkId, set);
  };
  for (const dk of dks) add(dk.id, dk.subsystemId);
  for (const task of tasks) add(task.dkId, task.moduleSubsystemId);

  const counts: GridCounts = new Map();
  for (const [dkId, subsystems] of touched) {
    const block = blockOf.get(dkId);
    if (!block) continue;
    for (const subsystem of subsystems) bump(counts, subsystem, block);
  }
  return counts;
}

/** МС × блоки, число задач. */
export function moduleTaskCounts(tasks: GridTask[]): GridCounts {
  const counts: GridCounts = new Map();
  for (const task of tasks) {
    if (task.moduleId) bump(counts, task.moduleId, task.blockKey);
  }
  return counts;
}

/** МС, задействованные в двух и более блоках, — их решётка подсвечивает. */
export function sharedModules(counts: GridCounts): Set<string> {
  const shared = new Set<string>();
  for (const [moduleId, blocks] of counts) {
    if (blocks.size >= 2) shared.add(moduleId);
  }
  return shared;
}
