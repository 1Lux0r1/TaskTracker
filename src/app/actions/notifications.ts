"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Прочитано: строка остаётся в списке, но из счётчика уходит. */
export async function markNotificationRead(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("notificationId") ?? "");
  if (!id) return;

  // Чужое уведомление прочитать нельзя: условие включает адресата.
  await prisma.notification.updateMany({
    where: { id, memberId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { memberId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}
