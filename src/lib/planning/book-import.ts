/**
 * Запись книги планирования в базу — общая для кнопки «Загрузить книгу» в
 * справочниках модуля и для команды npm run planning:import.
 *
 * Проверка (apply = false) проходит весь путь записи в транзакции и
 * откатывает её, поэтому её замечания те же, что будут при записи. Логика
 * книги местами сломана, и загрузка не останавливается на первой ошибке:
 * строки, которые не сходятся, пропускаются и перечисляются в замечаниях,
 * годные пишутся. Записи ищутся по коду и номеру, задачи — по шифру:
 * повторная загрузка обновляет, а не плодит дубли.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { type BookData, type BookSheet, parseBook } from "./book";
import {
  CIPHER_SETTINGS,
  PLAN_CODE_PATTERN,
  PLAN_PART_CODE_PATTERN,
  PLAN_STAGE_CODE_PATTERN,
  buildCipher,
} from "./cipher";
import { resolvePlanDates } from "./dates";
import { planTaskSearchIndex, recomputeCiphers } from "./service";

class DryRun extends Error {}

export type Counts = Record<string, { created: number; updated: number }>;

/** Пишет книгу в базу; counts и problems заполняются по ходу и переживают откат. */
async function load(
  prisma: PrismaClient,
  book: BookData,
  systemCode: string,
  apply: boolean,
  problems: string[],
  counts: Counts,
): Promise<void> {
  const count = (what: string, created: boolean) => {
    counts[what] ??= { created: 0, updated: 0 };
    counts[what][created ? "created" : "updated"] += 1;
  };
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  await prisma.$transaction(
    async (tx) => {
      const system = await tx.planSystem.upsert({
        where: { code: systemCode },
        update: book.systemName ? { name: book.systemName } : {},
        create: { code: systemCode, name: book.systemName ?? systemCode },
      });

      for (const stage of book.stages) {
        if (!PLAN_STAGE_CODE_PATTERN.test(stage.code)) {
          problems.push(`Этап «${stage.code}»: код этапа — только буквы, пропущен`);
          continue;
        }
        const existing = await tx.planStage.findUnique({ where: { code: stage.code } });
        await tx.planStage.upsert({
          where: { code: stage.code },
          update: { name: stage.name, level: stage.level, sortOrder: stage.sortOrder },
          create: stage,
        });
        count("этапы", !existing);
      }
      const stages = new Map((await tx.planStage.findMany()).map((item) => [item.code, item]));

      for (const [index, item] of book.subsystems.filter((s) => s.system === systemCode).entries()) {
        if (!PLAN_CODE_PATTERN.test(item.code)) {
          problems.push(`Подсистема «${item.code}»: код не годится для шифра, пропущена`);
          continue;
        }
        const where = { systemId_code: { systemId: system.id, code: item.code } };
        const existing = await tx.planSubsystem.findUnique({ where });
        await tx.planSubsystem.upsert({
          where,
          update: { name: item.name, sortOrder: index },
          create: { systemId: system.id, code: item.code, name: item.name, sortOrder: index },
        });
        count("подсистемы", !existing);
      }
      const subsystems = new Map(
        (await tx.planSubsystem.findMany({ where: { systemId: system.id } })).map((item) => [item.code, item]),
      );

      // Номера в подсистеме сначала снимаются с МС книги: иначе обмен номерами
      // двух МС споткнулся бы об уникальность пары «подсистема + номер».
      const modules = book.modules.filter((item) => item.system === systemCode);
      await tx.planModule.updateMany({
        where: { systemId: system.id, number: { in: modules.map((item) => item.number) } },
        data: { subsystemNumber: null },
      });
      const pairs = new Set<string>();
      for (const item of modules) {
        const subsystem = subsystems.get(item.subsystem);
        if (!subsystem) {
          problems.push(`МС № ${item.number} ${item.name}: подсистема «${item.subsystem}» не найдена, пропущен`);
          continue;
        }
        let subsystemNumber = item.subsystemNumber;
        const pair = `${subsystem.code}.${subsystemNumber}`;
        if (subsystemNumber && pairs.has(pair)) {
          problems.push(`МС № ${item.number} ${item.name}: номер ${pair} уже у другого МС реестра — номер в подсистеме не задан`);
          subsystemNumber = null;
        }
        if (subsystemNumber) {
          const holder = await tx.planModule.findUnique({
            where: { subsystemId_subsystemNumber: { subsystemId: subsystem.id, subsystemNumber } },
          });
          if (holder && holder.number !== item.number) {
            problems.push(`МС № ${item.number} ${item.name}: номер ${pair} занят МС № ${holder.number} в базе — номер в подсистеме не задан`);
            subsystemNumber = null;
          }
        }
        if (subsystemNumber) pairs.add(pair);
        else if (!item.subsystemNumber) problems.push(`МС № ${item.number} ${item.name}: нет номера в подсистеме — в шифр не попадёт`);

        const where = { systemId_number: { systemId: system.id, number: item.number } };
        const existing = await tx.planModule.findUnique({ where });
        const fields = { name: item.name, subsystemId: subsystem.id, subsystemNumber, version: item.version };
        await tx.planModule.upsert({ where, update: fields, create: { systemId: system.id, number: item.number, ...fields } });
        count("МС", !existing);
      }
      // Счётчики не откатываются назад: номер, выданный раньше, не переиспользуется.
      const maxNumber = Math.max(0, ...modules.map((item) => item.number));
      if (maxNumber > system.lastMsNumber) {
        await tx.planSystem.update({ where: { id: system.id }, data: { lastMsNumber: maxNumber } });
      }
      for (const subsystem of subsystems.values()) {
        const max = await tx.planModule.aggregate({ where: { subsystemId: subsystem.id }, _max: { subsystemNumber: true } });
        const value = max._max.subsystemNumber ?? 0;
        if (value > subsystem.lastMsNumber) {
          await tx.planSubsystem.update({ where: { id: subsystem.id }, data: { lastMsNumber: value } });
        }
      }

      for (const [index, item] of book.directions.entries()) {
        if (!PLAN_CODE_PATTERN.test(item.code)) {
          problems.push(`Направление «${item.code}»: код не годится для шифра, пропущено`);
          continue;
        }
        const where = { systemId_code: { systemId: system.id, code: item.code } };
        const existing = await tx.planDirection.findUnique({ where });
        await tx.planDirection.upsert({
          where,
          update: { name: item.name, sortOrder: index },
          create: { systemId: system.id, code: item.code, name: item.name, sortOrder: index },
        });
        count("направления", !existing);
      }
      const directions = new Map(
        (await tx.planDirection.findMany({ where: { systemId: system.id } })).map((item) => [item.code, item]),
      );

      const partIds = new Map<string, string>();
      for (const [index, item] of book.parts.entries()) {
        const direction = directions.get(item.direction);
        if (!direction) continue;
        if (!PLAN_PART_CODE_PATTERN.test(item.code)) {
          problems.push(`Раздел ${item.direction}.${item.code}: код не годится для шифра, пропущен`);
          continue;
        }
        const where = { directionId_code: { directionId: direction.id, code: item.code } };
        const existing = await tx.planDirectionPart.findUnique({ where });
        const part = await tx.planDirectionPart.upsert({
          where,
          update: { name: item.name, sortOrder: index },
          create: { directionId: direction.id, code: item.code, name: item.name, sortOrder: index },
        });
        partIds.set(`${item.direction}.${item.code}`, part.id);
        count("разделы (части)", !existing);
      }

      const dkIds = new Map<string, string>();
      for (const item of book.dks) {
        const partId = partIds.get(`${item.direction}.${item.part}`);
        if (!partId) continue;
        const where = { partId_number: { partId, number: item.number } };
        const existing = await tx.planDk.findUnique({ where });
        const dk = await tx.planDk.upsert({
          where,
          update: {
            name: item.name,
            status: item.status,
            deadline: item.deadline,
            ...(existing && existing.status !== item.status ? { statusSince: today } : {}),
          },
          create: {
            partId,
            number: item.number,
            name: item.name,
            status: item.status,
            statusSince: today,
            deadline: item.deadline,
            note: item.owner ? `Отв. по книге: ${item.owner}` : null,
          },
        });
        dkIds.set(`${item.direction}.${item.part}.${item.number}`, dk.id);
        count("пункты (ДК)", !existing);
      }

      const recomputed = await recomputeCiphers(tx, system.id);
      if (recomputed) counts["шифры пересобраны"] = { created: 0, updated: recomputed };

      const moduleByCode = new Map(
        (await tx.planModule.findMany({ where: { systemId: system.id }, include: { subsystem: true } }))
          .filter((item) => item.subsystemNumber)
          .map((item) => [`${item.subsystem.code}.${item.subsystemNumber}`, item]),
      );
      const seen = new Map<string, number>();
      for (const task of book.tasks) {
        const where = `«План работ», строка ${task.row}`;
        const dkKey = `${task.direction}.${task.part}.${task.dk}`;
        const dkId = dkIds.get(dkKey);
        const ms = moduleByCode.get(`${task.subsystem}.${task.msNumber}`);
        const stage = stages.get(task.stage);
        if (!dkId) {
          problems.push(`${where}: пункта ${systemCode}.${dkKey} нет в дорожной карте — задача пропущена`);
          continue;
        }
        if (!ms) {
          problems.push(`${where}: МС ${task.subsystem}.${task.msNumber} нет в реестре — задача пропущена`);
          continue;
        }
        if (!stage) continue;
        if (stage.level === "DK") {
          problems.push(`${where}: этап «${stage.code}» ведётся по пункту, а стоит под МС — задача пропущена`);
          continue;
        }
        const dates = resolvePlanDates({ start: task.startDate, weeks: null, finish: task.finishDate });
        if (!dates.ok) {
          problems.push(`${where}: ${dates.error} — задача пропущена`);
          continue;
        }

        const cipher = buildCipher(
          {
            system: systemCode,
            direction: task.direction,
            part: task.part,
            dkNumber: task.dk,
            msSubsystem: ms.subsystem.code,
            msNumber: ms.number,
            msSubsystemNumber: ms.subsystemNumber,
            stage: stage.code,
            repeat: task.repeat,
          },
          CIPHER_SETTINGS,
        );
        if (seen.has(cipher)) {
          problems.push(`${where}: шифр ${cipher} уже есть в строке ${seen.get(cipher)} — дубль пропущен`);
          continue;
        }
        seen.set(cipher, task.row);

        const fields = {
          dkId,
          stageId: stage.id,
          moduleId: ms.id,
          repeat: task.repeat,
          name: task.name,
          startDate: dates.value.start,
          finishDate: dates.value.finish,
          durationWeeks: dates.value.weeks,
          searchIndex: planTaskSearchIndex(cipher, task.name),
        };
        const existing = await tx.planTask.findUnique({ where: { cipher } });
        if (existing) await tx.planTask.update({ where: { id: existing.id }, data: fields });
        else await tx.planTask.create({ data: { ...fields, cipher } });
        count("задачи плана", !existing);
      }

      if (!apply) throw new DryRun();
    },
    { timeout: 300_000, maxWait: 30_000 },
  );
}

export type BookImportResult = {
  applied: boolean;
  /** Что найдено в книге и где. */
  found: string[];
  /** Сколько записей будет или было создано и обновлено. */
  counts: Counts;
  /** Что в книге не сходится. */
  problems: string[];
};

export async function importBook(
  prisma: PrismaClient,
  sheets: BookSheet[],
  options: { systemCode?: string; apply: boolean },
): Promise<BookImportResult> {
  const systemCode = options.systemCode ?? "RKII";
  const book = parseBook(sheets, systemCode);
  const problems = [...book.problems];
  const counts: Counts = {};
  try {
    await load(prisma, book, systemCode, options.apply, problems, counts);
  } catch (error) {
    // Проверка кончается откатом: счёт и замечания уже собраны.
    if (!(error instanceof DryRun)) throw error;
  }
  return { applied: options.apply, found: book.found, counts, problems };
}
