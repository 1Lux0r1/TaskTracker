import Link from "next/link";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime, plural } from "@/lib/domain";
import {
  notificationKindLabel,
  notificationKindTone,
} from "@/lib/notifications";
import { notificationHref, syncDerivedNotifications } from "@/lib/notifications-feed";

export const dynamic = "force-dynamic";

/**
 * Что горит: назначения, переносы сроков, просрочки и записи без движения.
 * Просрочка и застой видны только по времени, поэтому список пересобирается
 * при открытии страницы — планировщика в системе нет.
 */
export default async function NotificationsPage() {
  const user = await requireUser();
  await syncDerivedNotifications();

  const notifications = await prisma.notification.findMany({
    where: { memberId: user.id },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const unread = notifications.filter((item) => item.readAt === null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Уведомления</h1>
          <p className="text-sm text-gray-500">
            {unread.length > 0
              ? `${unread.length} ${plural(unread.length, "новое", "новых", "новых")} — назначения, переносы сроков, просрочки и записи без движения`
              : "Назначения, переносы сроков, просрочки и записи без движения"}
          </p>
        </div>
        {unread.length > 0 && (
          <form action={markAllNotificationsRead}>
            <SubmitButton className="btn-secondary" pendingLabel="…">
              Прочитать всё
            </SubmitButton>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          Пока ничего не горит: сроки на месте, записи в движении.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((item) => {
            const href = notificationHref(item.entity, item.entityId);
            const isNew = item.readAt === null;

            return (
              <li
                key={item.id}
                className={`card min-w-0 p-4 ${isNew ? "border-gray-300" : "opacity-70"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${notificationKindTone(item.kind)}`}>
                    {notificationKindLabel(item.kind)}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateTime(item.createdAt)}</span>
                </div>
                <p className="mt-1 min-w-0 font-medium text-gray-900">
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-500">{item.text}</p>
                  {isNew && (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="notificationId" value={item.id} />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        Прочитано
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
