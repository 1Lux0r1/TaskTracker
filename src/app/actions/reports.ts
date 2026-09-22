"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildReportDraft } from "@/lib/reports";
import { type ActionResult, formatZodError, weeklyReportInputSchema } from "@/lib/validation";

export async function createReport(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = weeklyReportInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  const duplicate = await prisma.weeklyReport.findFirst({
    where: {
      projectId: input.projectId,
      periodStart: input.periodStart!,
      periodEnd: input.periodEnd!,
    },
  });
  if (duplicate) return { ok: false, error: "Отчёт за этот период уже есть" };

  const report = await prisma.weeklyReport.create({
    data: { ...input, periodStart: input.periodStart!, periodEnd: input.periodEnd! },
  });

  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}

export async function updateReport(
  reportId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = weeklyReportInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const current = await prisma.weeklyReport.findUnique({ where: { id: reportId } });
  if (!current) return { ok: false, error: "Отчёт не найден" };
  if (current.state === "SUBMITTED") {
    return { ok: false, error: "Отчёт отправлен и больше не правится" };
  }

  const input = parsed.data;
  await prisma.weeklyReport.update({
    where: { id: reportId },
    data: { ...input, periodStart: input.periodStart!, periodEnd: input.periodEnd! },
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  return { ok: true, message: "Отчёт сохранён" };
}

export async function deleteReport(formData: FormData): Promise<void> {
  await requireUser();
  const reportId = String(formData.get("reportId") ?? "");
  if (!reportId) return;

  await prisma.weeklyReport.delete({ where: { id: reportId } });
  revalidatePath("/reports");
  redirect("/reports");
}

/**
 * Отправленный отчёт замораживается: иначе через неделю он покажет не то,
 * что ушло руководству, и сверить его будет нечем.
 */
export async function submitReport(formData: FormData): Promise<void> {
  await requireUser();
  const reportId = String(formData.get("reportId") ?? "");
  if (!reportId) return;

  await prisma.weeklyReport.update({
    where: { id: reportId },
    data: { state: "SUBMITTED", submittedAt: new Date() },
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
}

/**
 * Черновик отчёта собирается из фактических данных проекта за период,
 * чтобы руководителю оставалось только вычитать текст, а не писать с нуля.
 */
export async function generateReport(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const weeks = Number(formData.get("weeks") ?? 2);
  if (!projectId) return;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - weeks * 7 * 86_400_000);
  const draft = await buildReportDraft(projectId, periodStart, periodEnd);

  const existing = await prisma.weeklyReport.findFirst({
    where: { projectId, periodStart: draft.periodStart, periodEnd: draft.periodEnd },
  });

  const report = existing
    ? await prisma.weeklyReport.update({ where: { id: existing.id }, data: draft })
    : await prisma.weeklyReport.create({ data: { projectId, ...draft } });

  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}
