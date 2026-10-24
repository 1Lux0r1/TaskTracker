import { prisma } from "@/lib/db";
import { CIPHER_SETTINGS, buildCipher } from "@/lib/planning/cipher";

type Params = Record<string, string | string[] | undefined>;

export function param(params: Params, name: string): string | undefined {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Системы и выбранная: из адреса, иначе первая по коду. */
export async function pickSystem(params: Params) {
  const systems = await prisma.planSystem.findMany({ orderBy: { code: "asc" } });
  const asked = param(params, "system");
  const system = systems.find((item) => item.id === asked) ?? systems[0] ?? null;
  return { systems, system };
}

/** Дерево плана системы: направления → части (блоки) → ДК → задачи. */
export async function loadPlanTree(systemId: string) {
  return prisma.planDirection.findMany({
    where: { systemId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: {
      system: { select: { code: true } },
      parts: {
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        include: {
          dks: {
            orderBy: { number: "asc" },
            include: {
              subsystem: { select: { id: true, code: true, name: true } },
              tasks: {
                include: {
                  stage: true,
                  module: { include: { subsystem: { select: { id: true, code: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export type PlanTree = Awaited<ReturnType<typeof loadPlanTree>>;
export type PlanTreeDirection = PlanTree[number];
export type PlanTreePart = PlanTreeDirection["parts"][number];
export type PlanTreeDk = PlanTreePart["dks"][number];
export type PlanTreeTask = PlanTreeDk["tasks"][number];

/** Ключ блока для решётки и подписи: Gaz.Rte. */
export function blockKey(direction: { code: string }, part: { code: string }): string {
  return `${direction.code}.${part.code}`;
}

export function directionCipher(direction: PlanTreeDirection): string {
  return buildCipher({ system: direction.system.code, direction: direction.code }, CIPHER_SETTINGS);
}

export function blockCipher(direction: PlanTreeDirection, part: { code: string }): string {
  return buildCipher(
    { system: direction.system.code, direction: direction.code, part: part.code },
    CIPHER_SETTINGS,
  );
}

/**
 * Код ДК. При формате «подсистема из МС» у самого ДК подсистемы нет, и код
 * ДК кончается номером.
 */
export function dkCipher(
  direction: { code: string; system: { code: string } },
  part: { code: string },
  dk: { number: number; subsystem: { code: string } | null },
): string {
  return buildCipher(
    {
      system: direction.system.code,
      direction: direction.code,
      part: part.code,
      dkSubsystem: dk.subsystem?.code,
      dkNumber: dk.number,
    },
    CIPHER_SETTINGS,
  );
}

/** Порядок задач внутри ДК: сначала по ДК (БА, Арх), потом по МС, этапы по конвейеру. */
export function sortTasks<T extends { stage: { sortOrder: number }; module: { number: number } | null; repeat: number; startDate: Date | null }>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const am = a.module?.number ?? -1;
    const bm = b.module?.number ?? -1;
    if (am !== bm) return am - bm;
    const as = a.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bs = b.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (as !== bs) return as - bs;
    if (a.stage.sortOrder !== b.stage.sortOrder) return a.stage.sortOrder - b.stage.sortOrder;
    return a.repeat - b.repeat;
  });
}

/** Всё, что нужно калькулятору шифра в браузере: справочники и шифры плана. */
export async function loadCalculatorData(system: { id: string; code: string }) {
  const [parts, modules, stages, existing] = await Promise.all([
    prisma.planDirectionPart.findMany({
      where: { direction: { systemId: system.id } },
      orderBy: [{ direction: { sortOrder: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
      include: {
        direction: { select: { code: true, name: true } },
        dks: { orderBy: { number: "asc" }, include: { subsystem: { select: { code: true } } } },
      },
    }),
    prisma.planModule.findMany({
      where: { systemId: system.id },
      orderBy: [{ subsystem: { sortOrder: "asc" } }, { subsystem: { code: "asc" } }, { subsystemNumber: "asc" }, { number: "asc" }],
      include: { subsystem: { select: { code: true } } },
    }),
    prisma.planStage.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.planTask.findMany({
      where: { dk: { part: { direction: { systemId: system.id } } } },
      select: { id: true, dkId: true, stageId: true, moduleId: true, repeat: true, cipher: true },
    }),
  ]);

  return {
    system: { code: system.code },
    blocks: parts.map((part) => ({
      partId: part.id,
      directionCode: part.direction.code,
      partCode: part.code,
      label: `${part.direction.code}.${part.code} · ${part.direction.name} · ${part.name}`,
      dks: part.dks.map((dk) => ({
        id: dk.id,
        number: dk.number,
        name: dk.name,
        subsystemCode: dk.subsystem?.code ?? null,
      })),
    })),
    modules: modules.map((item) => ({
      id: item.id,
      number: item.number,
      subsystemNumber: item.subsystemNumber,
      name: item.name,
      subsystemCode: item.subsystem.code,
    })),
    stages: stages.map((item) => ({ id: item.id, code: item.code, name: item.name, level: item.level })),
    existing,
  };
}
