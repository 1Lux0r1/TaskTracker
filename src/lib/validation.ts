import { z } from "zod";
import {
  ARTIFACT_KINDS,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  LETTER_DIRECTIONS,
  LETTER_STATUSES,
  MEETING_KINDS,
  PROJECT_STATUSES,
  SIGNATURE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  REFERENCE_SECTIONS,
  TRACK_COLORS,
} from "@/lib/domain";

/** Пустая строка из формы означает «значение не задано», а не пустой текст. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

/**
 * Поле, которого в форме может не быть вовсе: состав полей зависит от
 * направления письма, поэтому отсутствующий ключ — это «не задано».
 */
const conditionalText = optionalText.optional().transform((value) => value ?? null);

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : new Date(`${value}T00:00:00`)))
  .nullable()
  .refine((value) => value === null || !Number.isNaN(value.getTime()), {
    message: "Некорректная дата",
  });

/**
 * Срок письма: при отметке «ответ не требуется» поле выключено и браузер
 * его не отправляет, поэтому отсутствующий ключ — это «срока нет».
 */
const conditionalDate = optionalDate.optional().transform((value) => value ?? null);

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

/**
 * Артефакты приходят повторяющимися полями формы: собираем их в список,
 * пустые строки отбрасываем — пользователь мог нажать «ещё артефакт» и
 * передумать.
 */
export function readArtifacts(formData: FormData) {
  const kinds = formData.getAll("artifactKind").map(String);
  const labels = formData.getAll("artifactLabel").map(String);
  const values = formData.getAll("artifactValue").map(String);

  return kinds
    .map((kind, index) => ({
      kind: ARTIFACT_KINDS.some((item) => item.value === kind) ? kind : "CUSTOM_VALUE",
      label: labels[index]?.trim() || null,
      value: values[index]?.trim() ?? "",
      sortOrder: index,
    }))
    .filter((artifact) => artifact.value.length > 0);
}

export const trackInputSchema = z.object({
  projectId: z.string().trim().min(1, "Выберите проект"),
  name: z.string().trim().min(1, "Укажите название трека").max(80),
  color: z.enum(TRACK_COLORS.map((item) => item.value) as [string, ...string[]]),
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
  trackId: z.string().trim().min(1, "Выберите трек"),
  progressNote: optionalText,
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
  // Поле есть не во всех формах: в быстром заведении сотрудника его нет.
  displayName: optionalText.optional().transform((value) => value ?? null),
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
  dueDate: conditionalDate,
  status: z.enum(LETTER_STATUSES),
  statusNote: optionalText,
  responseRef: optionalText,
  /// Резолюция — только у входящего, подписант и письмо-основание — только
  /// у исходящего, поэтому в форме есть лишь часть этих полей.
  resolution: conditionalText,
  signatory: conditionalText,
  responseToId: conditionalText,
  externalTaskKey: optionalText,
  comment: optionalText,
});

/** Время встречи: «ЧЧ:ММ» или пусто. */
const optionalTime = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
    message: "Время указывается как ЧЧ:ММ",
  });

export const meetingInputSchema = z
  .object({
    projectId: z.string().trim().min(1, "Выберите проект"),
    date: z
      .string()
      .trim()
      .min(1, "Укажите дату встречи")
      .transform((value) => new Date(`${value}T00:00:00`))
      .refine((value) => !Number.isNaN(value.getTime()), { message: "Некорректная дата" }),
    startTime: optionalTime,
    endTime: optionalTime,
    place: optionalText,
    kind: z.enum(MEETING_KINDS),
    subject: z.string().trim().min(1, "Укажите тему встречи").max(500),
    agenda: optionalText,
    decisions: optionalText,
    ownerId: optionalText,
  })
  .refine(
    (value) => !value.startTime || !value.endTime || value.startTime <= value.endTime,
    { message: "Встреча заканчивается раньше, чем начинается", path: ["endTime"] },
  );

export const orgContactInputSchema = z.object({
  counterpartyId: z.string().trim().min(1, "Выберите организацию"),
  fullName: z.string().trim().min(1, "Укажите ФИО").max(200),
  position: optionalText,
  email: optionalText,
  phone: optionalText,
  comment: optionalText,
});

export const referencePageInputSchema = z.object({
  // Страница может быть общей: раздел справочника живёт не только у проекта.
  projectId: optionalText,
  section: z.enum(REFERENCE_SECTIONS.map((item) => item.value) as [string, ...string[]]),
  title: z.string().trim().min(1, "Укажите заголовок").max(200),
  content: z.string().trim().min(1, "Страница без содержания не нужна"),
  authorId: optionalText,
});

export type ReferencePageInput = z.infer<typeof referencePageInputSchema>;

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
export type MeetingInput = z.infer<typeof meetingInputSchema>;
export type OrgContactInput = z.infer<typeof orgContactInputSchema>;
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
