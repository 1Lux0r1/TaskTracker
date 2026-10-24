import { z } from "zod";
import { PLAN_DK_STATUSES, PLAN_PRIORITIES, PLAN_STAGE_LEVELS } from "@/lib/domain";
import { PLAN_CODE_PATTERN, PLAN_PART_CODE_PATTERN, PLAN_STAGE_CODE_PATTERN } from "@/lib/planning/cipher";
import { optionalDate, optionalNumber, optionalText } from "@/lib/validation";

const code = (what: string) =>
  z
    .string()
    .trim()
    .min(1, `Укажите код: ${what}`)
    .max(12, `Код (${what}) — не длиннее 12 символов`)
    .regex(PLAN_CODE_PATTERN, `Код (${what}) — буквы и цифры, начинается с буквы, без точек и пробелов`);

const name = (what: string) => z.string().trim().min(1, `Укажите название: ${what}`).max(300);
const id = (what: string) => z.string().trim().min(1, `Выберите ${what}`);

export const planSystemSchema = z.object({
  code: code("система"),
  name: name("система"),
});

export const planDirectionSchema = z.object({
  systemId: id("систему"),
  code: code("направление"),
  name: name("направление"),
  goal: optionalText,
  deadline: optionalDate,
  priority: z.enum(PLAN_PRIORITIES.map((item) => item.value) as [string, ...string[]]),
  decisionDate: optionalDate,
  decisionBasis: optionalText,
  oftApprovedAt: optionalDate,
});

export const planPartSchema = z.object({
  directionId: id("направление"),
  code: z
    .string()
    .trim()
    .min(1, "Укажите код части направления")
    .max(12, "Код части — не длиннее 12 символов")
    .regex(PLAN_PART_CODE_PATTERN, "Код части — буквы и цифры (например, номер раздела ОФТ: 1, 14), без точек и пробелов"),
  name: name("часть направления"),
});

export const planSubsystemSchema = z.object({
  systemId: id("систему"),
  code: code("подсистема"),
  name: name("подсистема"),
});

export const planModuleSchema = z.object({
  name: name("МС"),
  subsystemId: id("подсистему МС"),
  version: optionalText,
});

export const planStageSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Укажите код этапа")
    .max(8, "Код этапа — не длиннее 8 символов")
    .regex(PLAN_STAGE_CODE_PATTERN, "Код этапа — только буквы: цифра в конце читалась бы как номер повтора"),
  name: name("этап"),
  level: z.enum(PLAN_STAGE_LEVELS.map((item) => item.value) as [string, ...string[]], {
    message: "Выберите уровень этапа",
  }),
});

export const planDkSchema = z.object({
  name: name("ДК"),
  subsystemId: optionalText,
  status: z.enum(PLAN_DK_STATUSES.map((item) => item.value) as [string, ...string[]]),
  statusSince: optionalDate,
  note: optionalText,
  deadline: optionalDate,
  trApprovedAt: optionalDate,
});

export const planTaskSchema = z.object({
  dkId: id("ДК"),
  stageId: id("этап"),
  moduleId: optionalText,
  repeat: optionalNumber,
  name: name("задача"),
  startDate: optionalDate,
  durationWeeks: optionalNumber,
  finishDate: optionalDate,
});
