import { prisma } from "@/lib/db";
import {
  CLOSED_TASK_STATUSES,
  documentKindLabel,
  documentStatusLabel,
  formatDate,
  isLetterOpen,
  letterDirectionLabel,
  startOfToday,
} from "@/lib/domain";

export type ReportDraft = {
  periodStart: Date;
  periodEnd: Date;
  releaseInfo: string | null;
  done: string;
  planned: string;
  blockers: string;
  solutions: string | null;
};

/** Начало суток, чтобы период не «плавал» от времени запуска. */
function atStartOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/**
 * Черновик отчёта руководству: закрытое за период, планы на следующий период,
 * блокеры (просрочки и отказы в подписании). Текст потом правится руками.
 */
export async function buildReportDraft(
  projectId: string,
  from: Date,
  to: Date,
): Promise<ReportDraft> {
  const periodStart = atStartOfDay(from);
  const periodEnd = atStartOfDay(to);
  const nextPeriodEnd = new Date(periodEnd.getTime() + (periodEnd.getTime() - periodStart.getTime()));
  const today = startOfToday();

  const [closedTasks, plannedTasks, overdueTasks, letters, documents] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId,
        status: { in: CLOSED_TASK_STATUSES },
        completedAt: { gte: periodStart, lte: periodEnd },
      },
      include: { assignee: true, track: true },
      orderBy: [{ track: { sortOrder: "asc" } }, { completedAt: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        projectId,
        status: { notIn: CLOSED_TASK_STATUSES },
        dueDate: { gte: today, lte: nextPeriodEnd },
      },
      include: { assignee: true },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.task.findMany({
      where: { projectId, status: { notIn: CLOSED_TASK_STATUSES }, dueDate: { lt: today } },
      include: { assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.letter.findMany({
      where: { projectId, dueDate: { lt: today } },
      include: { counterparty: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.document.findMany({
      where: { projectId },
      include: { counterparty: true, signatures: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const signedInPeriod = documents.filter(
    (item) => item.signedAt && item.signedAt >= periodStart && item.signedAt <= periodEnd,
  );
  const declined = documents.filter((item) => item.status === "DECLINED");
  const inSigning = documents.filter((item) =>
    ["SENT", "SIGNING", "REVIEW"].includes(item.status),
  );
  const overdueLetters = letters.filter((item) => isLetterOpen(item.status));

  const done = [
    section(
      "Производственный и внутренний трек",
      closedTasks.map(
        (task) =>
          `${task.title} (${task.track.name}${
            task.assignee ? `, ${task.assignee.fullName}` : ""
          })`,
      ),
    ),
    section(
      "Юридический трек: подписано за период",
      signedInPeriod.map(
        (item) =>
          `${documentKindLabel(item.kind)}: ${item.title}${
            item.counterparty ? ` — ${item.counterparty.name}` : ""
          }`,
      ),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  const planned = [
    section(
      "Задачи со сроком в следующем периоде",
      plannedTasks.map(
        (task) =>
          `${task.title} — до ${formatDate(task.dueDate)}${
            task.assignee ? `, ${task.assignee.fullName}` : ""
          }`,
      ),
    ),
    section(
      "Документы на согласовании и подписании",
      inSigning.map(
        (item) =>
          `${documentKindLabel(item.kind)}: ${item.title} — ${documentStatusLabel(item.status)}${
            item.nextAction ? `. ${item.nextAction}` : ""
          }`,
      ),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  const blockers = [
    section(
      "Просроченные задачи",
      overdueTasks.map(
        (task) =>
          `${task.title} — срок был ${formatDate(task.dueDate)}${
            task.assignee ? `, ${task.assignee.fullName}` : ""
          }`,
      ),
    ),
    section(
      "Просроченные письма",
      overdueLetters.map(
        (item) =>
          `${letterDirectionLabel(item.direction)} № ${item.number} от ${formatDate(item.date)}${
            item.counterparty ? ` (${item.counterparty.name})` : ""
          } — срок ${formatDate(item.dueDate)}`,
      ),
    ),
    section(
      "Отказы в подписании",
      declined.map(
        (item) =>
          `${item.title}${item.counterparty ? ` — ${item.counterparty.name}` : ""}${
            item.statusNote ? `: ${item.statusNote}` : ""
          }`,
      ),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  const solutions = section(
    "Предлагаемые шаги",
    documents
      .filter((item) => item.nextAction)
      .map((item) => `${item.title}: ${item.nextAction}`),
  );

  return {
    periodStart,
    periodEnd,
    releaseInfo: null,
    done: done || "За период закрытых задач и подписанных документов нет.",
    planned: planned || "Задач со сроком в следующем периоде нет.",
    blockers: blockers || "Блокеров нет.",
    solutions: solutions || null,
  };
}

/** Заголовок с маркированным списком; пустые разделы в отчёт не попадают. */
function section(title: string, items: string[]): string {
  if (items.length === 0) return "";
  return `${title}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}
