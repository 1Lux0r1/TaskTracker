import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/domain";
import { visibilityEntityHref, visibilityEntityLabel } from "@/lib/visibility";

export const dynamic = "force-dynamic";

/**
 * Журнал смен видимости. Признак публичного отображения после создания
 * записи меняет только администратор, и каждая правка остаётся здесь: видно,
 * кто и когда вывел запись в отчёт или убрал её оттуда.
 */
export default async function VisibilityLogPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return (
      <p className="card p-6 text-sm text-gray-500">
        Журнал видимости доступен администратору: видимость записей ведёт он.
      </p>
    );
  }

  const changes = await prisma.visibilityChange.findMany({
    orderBy: { createdAt: "desc" },
    include: { member: { select: { fullName: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/members" className="text-sm text-gray-500 hover:underline">
          ← Сотрудники
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Журнал видимости</h1>
        <p className="text-sm text-gray-500">
          Видимость задаёт автор при заведении записи. После создания её меняет только
          администратор, и каждая такая правка попадает сюда
        </p>
      </div>

      {changes.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          Видимость записей после создания ещё не меняли.
        </p>
      ) : (
        <ul className="space-y-2">
          {changes.map((change) => {
            const href = visibilityEntityHref(change.entity, change.entityId);
            return (
              <li key={change.id} className="card min-w-0 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 font-medium text-gray-900">
                    {visibilityEntityLabel(change.entity)}:{" "}
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {change.title}
                      </Link>
                    ) : (
                      change.title
                    )}
                  </p>
                  <span
                    className={`badge ${
                      change.isPublic
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {change.isPublic ? "стала публичной" : "стала служебной"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {change.member?.fullName ?? "Сотрудник удалён"} ·{" "}
                  {formatDateTime(change.createdAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
