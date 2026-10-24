/**
 * Начальные данные модуля: этапы методики и тестовый пример из задачи
 * заказчика — направление Gaz, блок Rte, ДК 01 «Построение трассировок»
 * с МС 08 terra-analyser-bff и ДК 02 «Поиск точек подключения к
 * магистральной сети».
 *
 * Названия направления, части и сроки задач — рабочие; terra-analyser-bff,
 * как в книге планирования, — № 8 реестра и третий МС подсистемы TA. Импорт
 * из книги (scripts/planning-import.ts) обновит справочники по коду. Загрузка повторяемая: существующие
 * записи находятся по коду и номеру, задачи — по шифру.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { addDays } from "./dates";
import { checkTaskDraft, planTaskSearchIndex } from "./service";

/**
 * Этапы в порядке книги планирования: ОА → БА → Арх → СА → Р → Т → Док →
 * Экс → Внед. «Экс» в книге заменил прежний DO (DevOps).
 */
export const DEFAULT_PLAN_STAGES = [
  { code: "ОА", name: "Отраслевой анализ", level: "DK" },
  { code: "БА", name: "Бизнес-анализ", level: "DK_OR_MS" },
  { code: "Арх", name: "Архитектура", level: "DK_OR_MS" },
  { code: "СА", name: "Системный анализ", level: "MS" },
  { code: "Р", name: "Разработка", level: "MS" },
  { code: "Т", name: "Тестирование", level: "MS" },
  { code: "Док", name: "Документация", level: "MS" },
  { code: "Экс", name: "Эксплуатация", level: "MS" },
  { code: "Внед", name: "Внедрение", level: "MS" },
] as const;

export async function ensurePlanStages(db: PrismaClient): Promise<void> {
  for (const [index, stage] of DEFAULT_PLAN_STAGES.entries()) {
    await db.planStage.upsert({
      where: { code: stage.code },
      update: {},
      create: { ...stage, sortOrder: index },
    });
  }
}

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

/** Задачи примера: этап, МС, повтор, наименование, старт, недель. */
const SAMPLE_TASKS: {
  dk: 1 | 2;
  stage: string;
  ms: number | null;
  name: string;
  start: Date;
  weeks: number;
}[] = [
  { dk: 1, stage: "СА", ms: 8, name: "Системный анализ трассировок в terra-analyser-bff", start: d(2026, 10, 5), weeks: 2 },
  { dk: 1, stage: "Р", ms: 8, name: "Разработка построения трассировок", start: d(2026, 10, 19), weeks: 3 },
  { dk: 1, stage: "Т", ms: 8, name: "Тестирование построения трассировок", start: d(2026, 11, 9), weeks: 1 },
  { dk: 1, stage: "СА", ms: 8, name: "Доработка постановки по итогам тестирования", start: d(2026, 11, 16), weeks: 1 },
  { dk: 1, stage: "Р", ms: 8, name: "Доработка трассировок по замечаниям", start: d(2026, 11, 23), weeks: 2 },
  { dk: 1, stage: "Т", ms: 8, name: "Повторное тестирование трассировок", start: d(2026, 12, 7), weeks: 1 },
  { dk: 1, stage: "Док", ms: 8, name: "Документация terra-analyser-bff", start: d(2026, 12, 14), weeks: 1 },
  { dk: 1, stage: "Экс", ms: 8, name: "Вывод terra-analyser-bff в продуктив", start: d(2026, 12, 21), weeks: 1 },
  { dk: 2, stage: "БА", ms: null, name: "Бизнес-анализ поиска точек подключения", start: d(2026, 10, 12), weeks: 3 },
  { dk: 2, stage: "Арх", ms: null, name: "Архитектурное решение поиска точек подключения", start: d(2026, 11, 2), weeks: 2 },
];

export async function loadPlanningSample(db: PrismaClient): Promise<{ tasks: number }> {
  await ensurePlanStages(db);

  const system = await db.planSystem.upsert({
    where: { code: "RKII" },
    update: {},
    create: { code: "RKII", name: "АИС РКИИЭ" },
  });

  const direction = await db.planDirection.upsert({
    where: { systemId_code: { systemId: system.id, code: "Gaz" } },
    update: {},
    create: {
      systemId: system.id,
      code: "Gaz",
      name: "Газоснабжение",
      goal: "Тестовый пример методики: трассировки и точки подключения к магистральной сети",
      priority: "MAIN",
      deadline: d(2027, 6, 30),
      decisionDate: d(2026, 9, 1),
      decisionBasis: "Тестовый пример из книги планирования",
      oftApprovedAt: d(2026, 9, 15),
    },
  });

  const part = await db.planDirectionPart.upsert({
    where: { directionId_code: { directionId: direction.id, code: "Rte" } },
    update: {},
    create: { directionId: direction.id, code: "Rte", name: "Трассировки" },
  });

  const subsystem = await db.planSubsystem.upsert({
    where: { systemId_code: { systemId: system.id, code: "TA" } },
    update: {},
    create: { systemId: system.id, code: "TA", name: "Подсистема анализа территорий" },
  });

  // Номер в подсистеме — 3, как в книге, если он свободен; иначе следующий.
  const existingMs = await db.planModule.findUnique({
    where: { systemId_number: { systemId: system.id, number: 8 } },
  });
  const takenThird = await db.planModule.findUnique({
    where: { subsystemId_subsystemNumber: { subsystemId: subsystem.id, subsystemNumber: 3 } },
  });
  const subsystemNumber = takenThird ? subsystem.lastMsNumber + 1 : 3;
  const ms =
    existingMs ??
    (await db.planModule.create({
      data: { systemId: system.id, number: 8, subsystemNumber, name: "terra-analyser-bff", subsystemId: subsystem.id },
    }));
  if (!existingMs && subsystem.lastMsNumber < subsystemNumber) {
    await db.planSubsystem.update({ where: { id: subsystem.id }, data: { lastMsNumber: subsystemNumber } });
  }
  if (system.lastMsNumber < 8) {
    await db.planSystem.update({ where: { id: system.id }, data: { lastMsNumber: 8 } });
  }

  const dk1 = await db.planDk.upsert({
    where: { partId_number: { partId: part.id, number: 1 } },
    update: {},
    create: {
      partId: part.id,
      number: 1,
      name: "Построение трассировок",
      subsystemId: subsystem.id,
      status: "PRODUCTION",
      statusSince: d(2026, 10, 5),
      trApprovedAt: d(2026, 10, 1),
    },
  });
  const dk2 = await db.planDk.upsert({
    where: { partId_number: { partId: part.id, number: 2 } },
    update: {},
    create: {
      partId: part.id,
      number: 2,
      name: "Поиск точек подключения к магистральной сети",
      subsystemId: subsystem.id,
      status: "ANALYSIS",
      statusSince: d(2026, 10, 12),
    },
  });

  const stages = new Map((await db.planStage.findMany()).map((stage) => [stage.code, stage.id]));
  let created = 0;
  // Повторы считаются по порядку: вторая СА по тому же МС — СА2.
  const seen = new Map<string, number>();
  for (const task of SAMPLE_TASKS) {
    const dkId = task.dk === 1 ? dk1.id : dk2.id;
    const key = `${dkId}:${task.stage}:${task.ms ?? ""}`;
    const repeat = (seen.get(key) ?? 0) + 1;
    seen.set(key, repeat);

    const check = await checkTaskDraft(db, {
      dkId,
      stageId: stages.get(task.stage)!,
      moduleId: task.ms ? ms.id : null,
      repeat,
    });
    if (!check.ok) {
      if (check.error.startsWith("Шифр ")) continue; // уже загружена
      throw new Error(check.error);
    }

    await db.planTask.create({
      data: {
        dkId,
        stageId: stages.get(task.stage)!,
        moduleId: task.ms ? ms.id : null,
        repeat: check.repeat,
        cipher: check.cipher,
        name: task.name,
        startDate: task.start,
        durationWeeks: task.weeks,
        finishDate: addDays(task.start, task.weeks * 7 - 1),
        searchIndex: planTaskSearchIndex(check.cipher, task.name),
      },
    });
    created += 1;
  }
  return { tasks: created };
}
