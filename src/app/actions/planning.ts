"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { startOfToday } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { resolvePlanDates } from "@/lib/planning/dates";
import {
  checkTaskDraft,
  planTaskSearchIndex,
  recomputeCiphers,
} from "@/lib/planning/service";
import {
  planDirectionSchema,
  planDkSchema,
  planModuleSchema,
  planPartSchema,
  planStageSchema,
  planSubsystemSchema,
  planSystemSchema,
  planTaskSchema,
} from "@/lib/planning/validation";
import { type ActionResult, formatZodError } from "@/lib/validation";

type State = ActionResult | null;

/** Все экраны модуля читают одни и те же записи — обновляем раздел целиком. */
function refresh(): void {
  revalidatePath("/planning", "layout");
}

function parse<T extends z.ZodType>(schema: T, formData: FormData) {
  return schema.safeParse(Object.fromEntries(formData));
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

/** Код занят: Prisma отвечает P2002 на нарушение уникального индекса. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/* ─── Система ─────────────────────────────────────────────────────────────── */

export async function savePlanSystem(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = parse(planSystemSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const id = field(formData, "id");

  try {
    if (id) {
      await prisma.$transaction(async (tx) => {
        await tx.planSystem.update({ where: { id }, data: parsed.data });
        await recomputeCiphers(tx, id);
      });
    } else {
      await prisma.planSystem.create({ data: parsed.data });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Система с таким кодом уже есть" };
    throw error;
  }
  refresh();
  return { ok: true, message: id ? "Система сохранена, шифры пересобраны" : "Система добавлена" };
}

/* ─── Направления ─────────────────────────────────────────────────────────── */

export async function createPlanDirection(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = parse(planDirectionSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const last = await prisma.planDirection.findFirst({
    where: { systemId: parsed.data.systemId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let created: { id: string };
  try {
    created = await prisma.planDirection.create({
      data: { ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `Направление с кодом ${parsed.data.code} в системе уже есть` };
    }
    throw error;
  }
  refresh();
  redirect(`/planning/directions/${created.id}`);
}

export async function updatePlanDirection(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const current = await prisma.planDirection.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Направление не найдено" };

  const parsed = parse(planDirectionSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  if (parsed.data.systemId !== current.systemId) {
    return { ok: false, error: "Направление нельзя перенести в другую систему" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.planDirection.update({ where: { id }, data: parsed.data });
      if (current.code !== parsed.data.code) await recomputeCiphers(tx, current.systemId);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `Направление с кодом ${parsed.data.code} в системе уже есть` };
    }
    throw error;
  }
  refresh();
  return { ok: true, message: "Направление сохранено" };
}

export async function deletePlanDirection(formData: FormData): Promise<void> {
  await requireUser();
  const id = field(formData, "id");
  const parts = await prisma.planDirectionPart.count({ where: { directionId: id } });
  if (parts > 0) {
    redirect(`/planning/directions/${id}?error=parts`);
  }
  await prisma.planDirection.delete({ where: { id } });
  refresh();
  redirect("/planning");
}

/* ─── Части направлений ───────────────────────────────────────────────────── */

export async function savePlanPart(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = parse(planPartSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const id = field(formData, "id");

  const direction = await prisma.planDirection.findUnique({ where: { id: parsed.data.directionId } });
  if (!direction) return { ok: false, error: "Направление не найдено в справочнике" };

  try {
    if (id) {
      const current = await prisma.planDirectionPart.findUnique({ where: { id } });
      if (!current) return { ok: false, error: "Часть направления не найдена" };
      if (current.directionId !== parsed.data.directionId) {
        return { ok: false, error: "Часть нельзя перенести в другое направление: сменились бы шифры ДК" };
      }
      await prisma.$transaction(async (tx) => {
        await tx.planDirectionPart.update({ where: { id }, data: parsed.data });
        if (current.code !== parsed.data.code) await recomputeCiphers(tx, direction.systemId);
      });
    } else {
      const last = await prisma.planDirectionPart.findFirst({
        where: { directionId: direction.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await prisma.planDirectionPart.create({
        data: { ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `Часть с кодом ${parsed.data.code} у направления ${direction.code} уже есть` };
    }
    throw error;
  }
  refresh();
  return { ok: true, message: id ? "Часть направления сохранена" : "Часть направления добавлена" };
}

export async function deletePlanPart(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const dks = await prisma.planDk.count({ where: { partId: id } });
  if (dks > 0) return { ok: false, error: "В блоке есть ДК: сначала удалите или перенесите их" };
  await prisma.planDirectionPart.delete({ where: { id } });
  refresh();
  return { ok: true, message: "Часть направления удалена" };
}

/* ─── Подсистемы ──────────────────────────────────────────────────────────── */

export async function savePlanSubsystem(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = parse(planSubsystemSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const id = field(formData, "id");

  try {
    if (id) {
      const current = await prisma.planSubsystem.findUnique({ where: { id } });
      if (!current || current.systemId !== parsed.data.systemId) {
        return { ok: false, error: "Подсистема не найдена" };
      }
      await prisma.$transaction(async (tx) => {
        await tx.planSubsystem.update({ where: { id }, data: parsed.data });
        if (current.code !== parsed.data.code) await recomputeCiphers(tx, current.systemId);
      });
    } else {
      const last = await prisma.planSubsystem.findFirst({
        where: { systemId: parsed.data.systemId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await prisma.planSubsystem.create({
        data: { ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: `Подсистема с кодом ${parsed.data.code} уже есть` };
    }
    throw error;
  }
  refresh();
  return { ok: true, message: id ? "Подсистема сохранена" : "Подсистема добавлена" };
}

export async function deletePlanSubsystem(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const [modules, dks] = await Promise.all([
    prisma.planModule.count({ where: { subsystemId: id } }),
    prisma.planDk.count({ where: { subsystemId: id } }),
  ]);
  if (modules + dks > 0) {
    return { ok: false, error: `Подсистема используется: МС — ${modules}, ДК — ${dks}` };
  }
  await prisma.planSubsystem.delete({ where: { id } });
  refresh();
  return { ok: true, message: "Подсистема удалена" };
}

/* ─── МС ──────────────────────────────────────────────────────────────────── */

/**
 * Новый МС получает следующий номер системы и следующий номер в подсистеме.
 * Номера берутся из счётчиков, а не из максимума существующих: номер
 * удалённого МС повторно не выдаётся.
 */
export async function createPlanModule(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = parse(planModuleSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const subsystem = await prisma.planSubsystem.findUnique({ where: { id: parsed.data.subsystemId } });
  if (!subsystem) return { ok: false, error: "Подсистема не найдена в справочнике" };

  const number = await prisma.$transaction(async (tx) => {
    const system = await tx.planSystem.update({
      where: { id: subsystem.systemId },
      data: { lastMsNumber: { increment: 1 } },
    });
    const inSubsystem = await tx.planSubsystem.update({
      where: { id: subsystem.id },
      data: { lastMsNumber: { increment: 1 } },
    });
    await tx.planModule.create({
      data: {
        ...parsed.data,
        systemId: subsystem.systemId,
        number: system.lastMsNumber,
        subsystemNumber: inSubsystem.lastMsNumber,
      },
    });
    return `${system.lastMsNumber}, в шифре ${subsystem.code}.${inSubsystem.lastMsNumber}`;
  });
  refresh();
  return { ok: true, message: `МС добавлен в реестр под номером ${number}` };
}

/**
 * Номер МС в реестре не правится: меняются название, подсистема и версия.
 * При переносе в другую подсистему МС получает там следующий номер.
 */
export async function updatePlanModule(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const current = await prisma.planModule.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "МС не найден" };

  const parsed = parse(planModuleSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const subsystem = await prisma.planSubsystem.findUnique({ where: { id: parsed.data.subsystemId } });
  if (!subsystem || subsystem.systemId !== current.systemId) {
    return { ok: false, error: "Подсистема не найдена в справочнике системы" };
  }

  await prisma.$transaction(async (tx) => {
    const moved = current.subsystemId !== parsed.data.subsystemId;
    const subsystemNumber = moved
      ? (
          await tx.planSubsystem.update({
            where: { id: subsystem.id },
            data: { lastMsNumber: { increment: 1 } },
          })
        ).lastMsNumber
      : current.subsystemNumber;
    await tx.planModule.update({ where: { id }, data: { ...parsed.data, subsystemNumber } });
    if (moved) await recomputeCiphers(tx, current.systemId);
  });
  refresh();
  return { ok: true, message: "МС сохранён" };
}

export async function deletePlanModule(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const tasks = await prisma.planTask.count({ where: { moduleId: id } });
  if (tasks > 0) return { ok: false, error: `По МС есть задачи плана (${tasks}): удалить нельзя` };
  await prisma.planModule.delete({ where: { id } });
  refresh();
  return { ok: true, message: "МС удалён, его номер больше не выдаётся" };
}

/* ─── Этапы ───────────────────────────────────────────────────────────────── */

export async function savePlanStage(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = parse(planStageSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const id = field(formData, "id");

  try {
    if (id) {
      const current = await prisma.planStage.findUnique({ where: { id } });
      if (!current) return { ok: false, error: "Этап не найден" };
      if (current.level !== parsed.data.level) {
        const used = await prisma.planTask.count({ where: { stageId: id } });
        if (used > 0) {
          return { ok: false, error: "Уровень этапа с задачами в плане не меняется: задачи потеряли бы смысл" };
        }
      }
      await prisma.$transaction(async (tx) => {
        await tx.planStage.update({ where: { id }, data: parsed.data });
        if (current.code !== parsed.data.code) {
          const systems = await tx.planSystem.findMany({ select: { id: true } });
          for (const system of systems) await recomputeCiphers(tx, system.id);
        }
      });
    } else {
      const last = await prisma.planStage.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await prisma.planStage.create({ data: { ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `Этап с кодом ${parsed.data.code} уже есть` };
    throw error;
  }
  refresh();
  return { ok: true, message: id ? "Этап сохранён" : "Этап добавлен" };
}

export async function deletePlanStage(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const tasks = await prisma.planTask.count({ where: { stageId: id } });
  if (tasks > 0) return { ok: false, error: `По этапу есть задачи плана (${tasks}): удалить нельзя` };
  await prisma.planStage.delete({ where: { id } });
  refresh();
  return { ok: true, message: "Этап удалён" };
}

/** Пересборка шифров вручную: после смены формата в CIPHER_SETTINGS. */
export async function rebuildPlanCiphers(): Promise<ActionResult> {
  await requireUser();
  const systems = await prisma.planSystem.findMany({ select: { id: true } });
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const system of systems) changed += await recomputeCiphers(tx, system.id);
  });
  refresh();
  return { ok: true, message: changed > 0 ? `Шифров пересобрано: ${changed}` : "Все шифры уже актуальны" };
}

/* ─── ДК ──────────────────────────────────────────────────────────────────── */

async function checkDkSubsystem(partId: string, subsystemId: string | null): Promise<string | null> {
  if (!subsystemId) return null;
  const [part, subsystem] = await Promise.all([
    prisma.planDirectionPart.findUnique({ where: { id: partId }, include: { direction: true } }),
    prisma.planSubsystem.findUnique({ where: { id: subsystemId } }),
  ]);
  if (!subsystem || !part || subsystem.systemId !== part.direction.systemId) {
    return "Подсистема не найдена в справочнике системы";
  }
  return null;
}

/** Номер ДК — следующий в блоке «направление + часть». */
export async function createPlanDk(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const partId = field(formData, "partId");
  if (!partId) return { ok: false, error: "Выберите блок: направление и часть" };
  const part = await prisma.planDirectionPart.findUnique({ where: { id: partId } });
  if (!part) return { ok: false, error: "Пара «направление + часть» не найдена в справочнике" };

  const parsed = parse(planDkSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const subsystemError = await checkDkSubsystem(partId, parsed.data.subsystemId);
  if (subsystemError) return { ok: false, error: subsystemError };

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const last = await tx.planDk.findFirst({
        where: { partId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const created = await tx.planDk.create({
        data: {
          ...parsed.data,
          partId,
          number: (last?.number ?? 0) + 1,
          statusSince: parsed.data.statusSince ?? startOfToday(),
        },
      });
      return created.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Номер ДК в блоке занят, повторите" };
    throw error;
  }
  refresh();
  redirect(`/planning/dk/${id}`);
}

export async function updatePlanDk(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const current = await prisma.planDk.findUnique({
    where: { id },
    include: { part: { include: { direction: true } } },
  });
  if (!current) return { ok: false, error: "ДК не найден" };

  const parsed = parse(planDkSchema, formData);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const subsystemError = await checkDkSubsystem(current.partId, parsed.data.subsystemId);
  if (subsystemError) return { ok: false, error: subsystemError };

  // Статус сменили, а дату «статус с» оставили прежней — статус с сегодня.
  const sameDate =
    (parsed.data.statusSince?.getTime() ?? null) === (current.statusSince?.getTime() ?? null);
  const statusSince =
    parsed.data.status !== current.status && sameDate ? startOfToday() : parsed.data.statusSince;

  await prisma.$transaction(async (tx) => {
    await tx.planDk.update({ where: { id }, data: { ...parsed.data, statusSince } });
    if (current.subsystemId !== parsed.data.subsystemId) {
      await recomputeCiphers(tx, current.part.direction.systemId);
    }
  });
  refresh();
  return { ok: true, message: "ДК сохранён" };
}

/** Быстрая смена статуса с дорожной карты. */
export async function setPlanDkStatus(formData: FormData): Promise<void> {
  await requireUser();
  const id = field(formData, "id");
  const status = planDkSchema.shape.status.safeParse(formData.get("status"));
  if (!status.success) return;
  const current = await prisma.planDk.findUnique({ where: { id } });
  if (!current || current.status === status.data) return;
  await prisma.planDk.update({ where: { id }, data: { status: status.data, statusSince: startOfToday() } });
  refresh();
}

export async function deletePlanDk(formData: FormData): Promise<void> {
  await requireUser();
  const id = field(formData, "id");
  const tasks = await prisma.planTask.count({ where: { dkId: id } });
  if (tasks > 0) redirect(`/planning/dk/${id}?error=tasks`);
  await prisma.planDk.delete({ where: { id } });
  refresh();
  redirect("/planning/roadmap");
}

/* ─── Задачи плана ────────────────────────────────────────────────────────── */

async function readTask(formData: FormData) {
  const parsed = parse(planTaskSchema, formData);
  if (!parsed.success) return { ok: false as const, error: formatZodError(parsed.error) };
  const { repeat, durationWeeks, startDate, finishDate, ...rest } = parsed.data;
  const dates = resolvePlanDates({ start: startDate, weeks: durationWeeks, finish: finishDate });
  if (!dates.ok) return { ok: false as const, error: dates.error };
  return {
    ok: true as const,
    data: rest,
    repeat,
    dates: dates.value,
  };
}

export async function createPlanTask(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const task = await readTask(formData);
  if (!task.ok) return task;

  const check = await checkTaskDraft(prisma, {
    dkId: task.data.dkId,
    stageId: task.data.stageId,
    moduleId: task.data.moduleId,
    repeat: task.repeat,
  });
  if (!check.ok) return check;

  try {
    await prisma.planTask.create({
      data: {
        ...task.data,
        repeat: check.repeat,
        cipher: check.cipher,
        startDate: task.dates.start,
        durationWeeks: task.dates.weeks,
        finishDate: task.dates.finish,
        searchIndex: planTaskSearchIndex(check.cipher, task.data.name),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `Шифр ${check.cipher} уже есть в плане` };
    throw error;
  }
  refresh();
  return { ok: true, message: `Задача ${check.cipher} добавлена в план` };
}

export async function updatePlanTask(_state: State, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const id = field(formData, "id");
  const current = await prisma.planTask.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Задача не найдена" };

  const task = await readTask(formData);
  if (!task.ok) return task;

  const check = await checkTaskDraft(
    prisma,
    {
      dkId: task.data.dkId,
      stageId: task.data.stageId,
      moduleId: task.data.moduleId,
      repeat: task.repeat ?? current.repeat,
    },
    id,
  );
  if (!check.ok) return check;

  try {
    await prisma.planTask.update({
      where: { id },
      data: {
        ...task.data,
        repeat: check.repeat,
        cipher: check.cipher,
        startDate: task.dates.start,
        durationWeeks: task.dates.weeks,
        finishDate: task.dates.finish,
        searchIndex: planTaskSearchIndex(check.cipher, task.data.name),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `Шифр ${check.cipher} уже есть в плане` };
    throw error;
  }
  refresh();
  return { ok: true, message: `Задача сохранена: ${check.cipher}` };
}

export async function deletePlanTask(formData: FormData): Promise<void> {
  await requireUser();
  const id = field(formData, "id");
  const task = await prisma.planTask.findUnique({ where: { id }, select: { dkId: true } });
  if (!task) redirect("/planning/plan");
  await prisma.planTask.delete({ where: { id } });
  refresh();
  redirect(`/planning/dk/${task.dkId}`);
}
