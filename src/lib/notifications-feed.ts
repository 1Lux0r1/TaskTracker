import { prisma } from "@/lib/db";
import {
  CLOSED_LETTER_STATUSES,
  CLOSED_TASK_STATUSES,
  formatDate,
  startOfToday,
} from "@/lib/domain";
import {
  type NotificationKind,
  STALE_DAYS,
  dayStamp,
  daysWithoutMovement,
  notificationKey,
  weekStamp,
} from "@/lib/notifications";
import { VISIBILITY_ENTITIES, type VisibilityEntity } from "@/lib/visibility";

/** Стадии документа, после которых напоминать уже не о чем. */
const CLOSED_DOCUMENT_STATUSES = ["SIGNED", "FILED", "DECLINED"];

type NewNotification = {
  memberId: string;
  kind: NotificationKind;
  entity: VisibilityEntity;
  entityId: string;
  title: string;
  text: string;
  dedupKey: string;
};

/**
 * Уведомление появляется один раз. SQLite не умеет пропускать дубли при
 * массовой вставке, поэтому уже записанные ключи отбираются запросом, а
 * гонка двух вкладок ловится уникальным индексом.
 */
async function put(items: NewNotification[]): Promise<number> {
  if (items.length === 0) return 0;

  const known = await prisma.notification.findMany({
    where: { dedupKey: { in: items.map((item) => item.dedupKey) } },
    select: { memberId: true, dedupKey: true },
  });

  const seen = new Set(known.map((item) => `${item.memberId}|${item.dedupKey}`));
  const fresh: NewNotification[] = [];
  for (const item of items) {
    const key = `${item.memberId}|${item.dedupKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(item);
  }
  if (fresh.length === 0) return 0;

  try {
    const result = await prisma.notification.createMany({ data: fresh });
    return result.count;
  } catch {
    // Тот же ключ успела записать соседняя вкладка — это не ошибка.
    return 0;
  }
}

/** Адресат события: ответственный, иначе владелец проекта, иначе админы. */
async function recipients(
  ownerId: string | null,
  projectId: string,
): Promise<string[]> {
  if (ownerId) return [ownerId];

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (project?.ownerId) return [project.ownerId];

  const admins = await prisma.member.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  return admins.map((admin) => admin.id);
}

/** Задачу назначили: ответственный узнаёт об этом, не заходя в реестр. */
export async function notifyAssignment(
  taskId: string,
  title: string,
  assigneeId: string | null,
  actorId: string,
): Promise<void> {
  // Назначение самому себе — не новость: человек только что это сделал.
  if (!assigneeId || assigneeId === actorId) return;

  await put([
    {
      memberId: assigneeId,
      kind: "ASSIGNED",
      entity: "TASK",
      entityId: taskId,
      title,
      text: "Задача назначена на вас",
      dedupKey: notificationKey("ASSIGNED", "TASK", taskId, assigneeId),
    },
  ]);
}

/** Срок перенесли: узнаёт тот, кто за запись отвечает. */
export async function notifyDueChange(
  entity: VisibilityEntity,
  entityId: string,
  title: string,
  ownerId: string | null,
  projectId: string,
  dueDate: Date | null,
  actorId: string,
): Promise<void> {
  const people = (await recipients(ownerId, projectId)).filter((id) => id !== actorId);
  if (people.length === 0) return;

  const text = dueDate ? `Срок перенесён на ${formatDate(dueDate)}` : "Срок снят";
  await put(
    people.map((memberId) => ({
      memberId,
      kind: "DUE_CHANGED" as const,
      entity,
      entityId,
      title,
      text,
      dedupKey: notificationKey("DUE_CHANGED", entity, entityId, dayStamp(dueDate)),
    })),
  );
}

/**
 * Просрочки и записи без движения событиями не приходят: их видно только по
 * времени. Планировщика в системе нет, поэтому список пересобирается при
 * открытии страниц — ключ события не даёт уведомлениям задвоиться.
 */
export async function syncDerivedNotifications(): Promise<number> {
  const today = startOfToday();
  const staleBefore = new Date(today.getTime() - STALE_DAYS * 86_400_000);
  const week = weekStamp(today);

  const [tasks, letters, documents] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: { notIn: CLOSED_TASK_STATUSES },
        OR: [{ dueDate: { lt: today } }, { updatedAt: { lt: staleBefore } }],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        updatedAt: true,
        assigneeId: true,
        projectId: true,
      },
    }),
    prisma.letter.findMany({
      where: {
        status: { notIn: CLOSED_LETTER_STATUSES },
        OR: [{ dueDate: { lt: today } }, { updatedAt: { lt: staleBefore } }],
      },
      select: {
        id: true,
        number: true,
        subject: true,
        dueDate: true,
        updatedAt: true,
        ownerId: true,
        projectId: true,
      },
    }),
    prisma.document.findMany({
      where: {
        status: { notIn: CLOSED_DOCUMENT_STATUSES },
        OR: [{ dueDate: { lt: today } }, { updatedAt: { lt: staleBefore } }],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        updatedAt: true,
        ownerId: true,
        projectId: true,
      },
    }),
  ]);

  const items: NewNotification[] = [];

  async function collect(
    entity: VisibilityEntity,
    entityId: string,
    title: string,
    ownerId: string | null,
    projectId: string,
    dueDate: Date | null,
    updatedAt: Date,
  ) {
    const people = await recipients(ownerId, projectId);
    for (const memberId of people) {
      if (dueDate && dueDate < today) {
        items.push({
          memberId,
          kind: "OVERDUE",
          entity,
          entityId,
          title,
          text: `Срок был ${formatDate(dueDate)}`,
          dedupKey: notificationKey("OVERDUE", entity, entityId, dayStamp(dueDate)),
        });
      }
      if (updatedAt < staleBefore) {
        items.push({
          memberId,
          kind: "STALE",
          entity,
          entityId,
          title,
          text: `Без движения ${daysWithoutMovement(updatedAt, today)} дн.`,
          dedupKey: notificationKey("STALE", entity, entityId, week),
        });
      }
    }
  }

  for (const task of tasks) {
    await collect("TASK", task.id, task.title, task.assigneeId, task.projectId, task.dueDate, task.updatedAt);
  }
  for (const letter of letters) {
    await collect(
      "LETTER",
      letter.id,
      `№ ${letter.number} — ${letter.subject}`,
      letter.ownerId,
      letter.projectId,
      letter.dueDate,
      letter.updatedAt,
    );
  }
  for (const document of documents) {
    await collect(
      "DOCUMENT",
      document.id,
      document.title,
      document.ownerId,
      document.projectId,
      document.dueDate,
      document.updatedAt,
    );
  }

  return put(items);
}

/** Сколько непрочитанного у сотрудника: число для значка в шапке. */
export async function unreadCount(memberId: string): Promise<number> {
  return prisma.notification.count({ where: { memberId, readAt: null } });
}

/** Ссылка на запись, о которой уведомление. */
export function notificationHref(entity: string, entityId: string): string | null {
  const found = VISIBILITY_ENTITIES.find((item) => item.value === entity);
  return found ? `${found.href}/${entityId}` : null;
}
