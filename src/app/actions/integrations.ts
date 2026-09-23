"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INTEGRATION_STAGES } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

/** Дата из формы: пустое поле значит «не задано», а не «сегодня». */
function readDate(formData: FormData, field: string): Date | null {
  const value = String(formData.get(field) ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00`);
}

/**
 * Строка графика — организация целиком: пять этапов правятся вместе, как в
 * исходной таблице, где строку заполняли в один заход.
 */
export async function saveIntegrationRow(
  projectId: string,
  counterpartyId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  if (!projectId || !counterpartyId) return { ok: false, error: "Не понятно, что сохранять" };

  await prisma.$transaction(
    INTEGRATION_STAGES.map((stage, index) => {
      const plannedDate = readDate(formData, `planned_${stage.value}`);
      const actualDate = readDate(formData, `actual_${stage.value}`);
      const comment = String(formData.get(`comment_${stage.value}`) ?? "").trim() || null;

      return prisma.counterpartyMilestone.upsert({
        where: {
          projectId_counterpartyId_stage: { projectId, counterpartyId, stage: stage.value },
        },
        create: {
          projectId,
          counterpartyId,
          stage: stage.value,
          sortOrder: index,
          plannedDate,
          actualDate,
          comment,
        },
        update: { sortOrder: index, plannedDate, actualDate, comment },
      });
    }),
  );

  revalidatePath("/integrations");
  return { ok: true, message: "Строка сохранена" };
}

/**
 * Организация появляется в графике пустой строкой: даты проставляются по
 * мере движения, а сам факт участия виден сразу.
 */
export async function addIntegrationRow(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const counterpartyId = String(formData.get("counterpartyId") ?? "");
  if (!projectId) return { ok: false, error: "Выберите проект" };
  if (!counterpartyId) return { ok: false, error: "Выберите организацию" };

  const existing = await prisma.counterpartyMilestone.count({
    where: { projectId, counterpartyId },
  });
  if (existing > 0) return { ok: false, error: "Организация уже в графике" };

  await prisma.counterpartyMilestone.createMany({
    data: INTEGRATION_STAGES.map((stage, index) => ({
      projectId,
      counterpartyId,
      stage: stage.value,
      sortOrder: index,
    })),
  });

  revalidatePath("/integrations");
  return { ok: true, message: "Организация добавлена в график" };
}

/** Снятие организации с графика удаляет её вехи по этому проекту. */
export async function removeIntegrationRow(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const counterpartyId = String(formData.get("counterpartyId") ?? "");
  if (!projectId || !counterpartyId) return;

  await prisma.counterpartyMilestone.deleteMany({ where: { projectId, counterpartyId } });
  revalidatePath("/integrations");
}
