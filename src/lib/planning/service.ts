/**
 * Работа модуля планирования с базой: шифр задачи из связанных записей,
 * пересборка шифров после смены кода в справочнике, черновик задачи с
 * проверкой дубля. Импорты относительные: модуль зовут и скрипты загрузки.
 */
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { buildSearchIndex } from "../search";
import { CIPHER_SETTINGS, type CipherInput, buildCipher, nextRepeat } from "./cipher";

type Db = PrismaClient | Prisma.TransactionClient;

/** Всё, из чего складывается шифр задачи. */
export const PLAN_TASK_CIPHER_INCLUDE = {
  stage: { select: { code: true, level: true } },
  module: { select: { number: true, subsystemNumber: true, subsystem: { select: { code: true } } } },
  dk: {
    select: {
      number: true,
      subsystem: { select: { code: true } },
      part: {
        select: {
          code: true,
          direction: { select: { code: true, system: { select: { code: true } } } },
        },
      },
    },
  },
} satisfies Prisma.PlanTaskInclude;

export type PlanTaskForCipher = Prisma.PlanTaskGetPayload<{
  include: typeof PLAN_TASK_CIPHER_INCLUDE;
}>;

export function cipherInputOfTask(task: PlanTaskForCipher): CipherInput {
  return {
    system: task.dk.part.direction.system.code,
    direction: task.dk.part.direction.code,
    part: task.dk.part.code,
    dkSubsystem: task.dk.subsystem?.code,
    msSubsystem: task.module?.subsystem.code,
    dkNumber: task.dk.number,
    msNumber: task.module?.number,
    msSubsystemNumber: task.module?.subsystemNumber,
    stage: task.stage.code,
    repeat: task.repeat,
  };
}

/** Поисковая строка задачи: шифр и наименование строчными буквами. */
export function planTaskSearchIndex(cipher: string, name: string): string {
  return buildSearchIndex([cipher, name]);
}

/**
 * Пересобирает шифры всех задач системы. Зовётся после смены кода в
 * справочнике, подсистемы ДК или МС и после смены формата шифра. Сначала
 * все шифры уводятся во временные значения: при обмене кодами двух записей
 * уникальный индекс иначе споткнулся бы о ещё не пересчитанную соседнюю.
 */
export async function recomputeCiphers(db: Db, systemId: string): Promise<number> {
  const tasks = await db.planTask.findMany({
    where: { dk: { part: { direction: { systemId } } } },
    include: PLAN_TASK_CIPHER_INCLUDE,
  });

  const changed = tasks
    .map((task) => ({ task, cipher: buildCipher(cipherInputOfTask(task), CIPHER_SETTINGS) }))
    .filter(({ task, cipher }) => task.cipher !== cipher);

  for (const { task } of changed) {
    await db.planTask.update({ where: { id: task.id }, data: { cipher: `~${task.id}` } });
  }
  for (const { task, cipher } of changed) {
    await db.planTask.update({
      where: { id: task.id },
      data: { cipher, searchIndex: planTaskSearchIndex(cipher, task.name) },
    });
  }
  return changed.length;
}

export type TaskDraft = {
  dkId: string;
  stageId: string;
  moduleId: string | null;
  /** Номер повтора; пусто — система подставит следующий свободный. */
  repeat: number | null;
};

export type TaskDraftCheck =
  | { ok: true; cipher: string; repeat: number }
  | { ok: false; error: string };

/**
 * Проверка задачи перед записью: этап сочетается с МС по уровню, номер
 * повтора свободен, шифр уникален. Тот же порядок проверок повторяет
 * калькулятор в браузере, но последнее слово — здесь.
 */
export async function checkTaskDraft(
  db: Db,
  draft: TaskDraft,
  exceptTaskId?: string,
): Promise<TaskDraftCheck> {
  const [dk, stage, module] = await Promise.all([
    db.planDk.findUnique({
      where: { id: draft.dkId },
      include: {
        subsystem: { select: { code: true } },
        part: {
          select: {
            code: true,
            direction: { select: { code: true, systemId: true, system: { select: { code: true } } } },
          },
        },
      },
    }),
    db.planStage.findUnique({ where: { id: draft.stageId } }),
    draft.moduleId
      ? db.planModule.findUnique({
          where: { id: draft.moduleId },
          include: { subsystem: { select: { code: true } } },
        })
      : Promise.resolve(null),
  ]);

  if (!dk) return { ok: false, error: "ДК не найден" };
  if (!stage) return { ok: false, error: "Этап не найден в справочнике" };
  if (draft.moduleId && !module) return { ok: false, error: "МС не найден в справочнике" };
  if (module && module.systemId !== dk.part.direction.systemId) {
    return { ok: false, error: "МС относится к другой системе" };
  }
  if (stage.level === "MS" && !module) {
    return { ok: false, error: `Этап «${stage.code}» ведётся по МС: выберите МС` };
  }
  if (stage.level === "DK" && module) {
    return { ok: false, error: `Этап «${stage.code}» ведётся по ДК: МС для него не указывается` };
  }

  const siblings = await db.planTask.findMany({
    where: {
      dkId: dk.id,
      stageId: stage.id,
      moduleId: module?.id ?? null,
      ...(exceptTaskId ? { id: { not: exceptTaskId } } : {}),
    },
    select: { repeat: true, cipher: true },
  });

  const repeat = draft.repeat ?? nextRepeat(siblings.map((item) => item.repeat));
  if (!Number.isInteger(repeat) || repeat < 1) {
    return { ok: false, error: "Номер повтора — целое число от 1" };
  }

  const cipher = buildCipher(
    {
      system: dk.part.direction.system.code,
      direction: dk.part.direction.code,
      part: dk.part.code,
      dkSubsystem: dk.subsystem?.code,
      msSubsystem: module?.subsystem.code,
      dkNumber: dk.number,
      msNumber: module?.number,
      msSubsystemNumber: module?.subsystemNumber,
      stage: stage.code,
      repeat,
    },
    CIPHER_SETTINGS,
  );

  const taken = await db.planTask.findFirst({
    where: { cipher, ...(exceptTaskId ? { id: { not: exceptTaskId } } : {}) },
    select: { id: true },
  });
  if (taken || siblings.some((item) => item.repeat === repeat)) {
    const free = nextRepeat(siblings.map((item) => item.repeat));
    return {
      ok: false,
      error: `Шифр ${cipher} уже есть в плане. Следующий свободный номер повтора — ${free}`,
    };
  }

  return { ok: true, cipher, repeat };
}
