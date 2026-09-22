import { z } from "zod";
import {
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  LETTER_DIRECTIONS,
  LETTER_STATUSES,
  PROJECT_STATUSES,
  SIGNATURE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TRACKS,
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
  externalAssignee: optionalText,
  externalTaskKey: optionalText,
  track: z.enum(TASK_TRACKS),
  progressNote: optionalText,
  resultLink: optionalText,
  letterId: optionalText,
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

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || /^https?:\/\//i.test(value), {
    message: "Ссылка должна начинаться с http:// или https://",
  });

export const counterpartyInputSchema = z.object({
  name: z.string().trim().min(2, "Укажите название организации").max(300),
  shortName: optionalText,
  isInternal: z.coerce.boolean().default(false),
});

export const letterInputSchema = z.object({
  projectId: z.string().trim().min(1, "Выберите проект"),
  number: z.string().trim().min(1, "Укажите номер письма").max(100),
  direction: z.enum(LETTER_DIRECTIONS),
  date: optionalDate,
  subject: z.string().trim().min(1, "Укажите тему письма").max(500),
  url: optionalUrl,
  counterpartyId: optionalText,
  ownerId: optionalText,
  dueDate: optionalDate,
  status: z.enum(LETTER_STATUSES),
  statusNote: optionalText,
  responseRef: optionalText,
  externalTaskKey: optionalText,
  comment: optionalText,
});

export const documentInputSchema = z.object({
  projectId: z.string().trim().min(1, "Выберите проект"),
  kind: z.enum(DOCUMENT_KINDS),
  title: z.string().trim().min(1, "Укажите название документа").max(500),
  counterpartyId: optionalText,
  ownerId: optionalText,
  status: z.enum(DOCUMENT_STATUSES),
  statusNote: optionalText,
  nextAction: optionalText,
  dueDate: optionalDate,
  outgoingLetterId: optionalText,
  incomingLetterId: optionalText,
});

export const signatureInputSchema = z.object({
  documentId: z.string().trim().min(1),
  party: z.string().trim().min(1, "Укажите сторону").max(200),
  counterpartyId: optionalText,
  status: z.enum(SIGNATURE_STATUSES),
  signedAt: optionalDate,
  url: optionalUrl,
  note: optionalText,
});

export const weeklyReportInputSchema = z
  .object({
    projectId: z.string().trim().min(1, "Выберите проект"),
    periodStart: optionalDate,
    periodEnd: optionalDate,
    releaseInfo: optionalText,
    done: optionalText,
    planned: optionalText,
    blockers: optionalText,
    solutions: optionalText,
    authorId: optionalText,
  })
  .refine((value) => value.periodStart !== null && value.periodEnd !== null, {
    message: "Укажите начало и конец периода",
  })
  .refine(
    (value) =>
      value.periodStart === null ||
      value.periodEnd === null ||
      value.periodStart <= value.periodEnd,
    { message: "Начало периода позже его конца" },
  );

export type CounterpartyInput = z.infer<typeof counterpartyInputSchema>;
export type LetterInput = z.infer<typeof letterInputSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type SignatureInput = z.infer<typeof signatureInputSchema>;
export type WeeklyReportInput = z.infer<typeof weeklyReportInputSchema>;

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
