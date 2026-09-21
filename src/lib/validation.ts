import { z } from "zod";
import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/domain";

/** Пустая строка из формы означает «значение не задано», а не пустой текст. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : new Date(`${value}T00:00:00`)))
  .nullable()
  .refine((value) => value === null || !Number.isNaN(value.getTime()), {
    message: "Некорректная дата",
  });

const optionalNumber = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : Number(value.replace(",", "."))))
  .nullable()
  .refine((value) => value === null || Number.isFinite(value), {
    message: "Некорректное число",
  });

export const projectInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Код проекта — минимум 2 символа")
    .max(16, "Код проекта — максимум 16 символов")
    .regex(/^[A-Za-zА-Яа-я0-9_-]+$/, "Код может содержать только буквы, цифры, дефис и подчёркивание")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "Укажите название проекта").max(200),
  description: optionalText,
  status: z.enum(PROJECT_STATUSES),
  startDate: optionalDate,
  dueDate: optionalDate,
  ownerId: optionalText,
});

export const taskInputSchema = z.object({
  projectId: z.string().trim().min(1, "Выберите проект"),
  title: z.string().trim().min(1, "Укажите название задачи").max(300),
  description: optionalText,
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: optionalText,
  parentId: optionalText,
  startDate: optionalDate,
  dueDate: optionalDate,
  estimateHours: optionalNumber,
  spentHours: optionalNumber,
  progress: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? 0 : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0 && value <= 100, {
      message: "Прогресс задаётся числом от 0 до 100",
    }),
});

export const memberInputSchema = z.object({
  fullName: z.string().trim().min(1, "Укажите ФИО").max(200),
  email: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine((value) => value === null || z.email().safeParse(value).success, {
      message: "Некорректный email",
    }),
  position: optionalText,
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/** Собирает ошибки zod в одну строку — форма показывает её над полями. */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}
