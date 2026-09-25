import Link from "next/link";
import { revokeMemberAccess, setMemberPassword, toggleMemberRole } from "@/app/actions/auth";
import { createMember, toggleMemberActive, updateMember } from "@/app/actions/members";
import { MemberAccess } from "@/components/member-access";
import { MemberEditForm } from "@/components/member-edit-form";
import { MemberForm } from "@/components/member-form";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Avatar, Pill } from "@/components/ui";
import { CLOSED_TASK_STATUSES } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const members = await prisma.member.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    include: {
      _count: { select: { assignedTasks: true, ownedProjects: true } },
    },
  });

  const openCounts = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: { status: { notIn: CLOSED_TASK_STATUSES }, assigneeId: { not: null } },
    _count: { _all: true },
  });
  const openByMember = new Map(
    openCounts.map((row) => [row.assigneeId as string, row._count._all]),
  );

  const activeAdmins = members.filter((item) => item.role === "ADMIN" && item.isActive).length;

  /**
   * Архив закрывает вход, поэтому кнопка есть только у администратора и никогда
   * не появляется на себе и на последнем администраторе: систему нельзя
   * оставить без того, кто вернёт доступ.
   */
  function canArchive(member: { id: string; role: string; isActive: boolean }): boolean {
    if (!isAdmin) return false;
    if (!member.isActive) return true;
    if (member.id === user.id) return false;
    if (member.role === "ADMIN" && activeAdmins <= 1) return false;
    return true;
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/directory" className="text-sm text-gray-500 hover:underline">
          ← Справочники
        </Link>
        <h1 className="mt-1 text-[25px] leading-tight font-bold text-gray-900">Сотрудники</h1>
        <p className="text-sm text-gray-500">
          {isAdmin
            ? "Карточки, пароли и роли сотрудников ведёт администратор. Роли различаются только этим: работать с задачами, письмами и документами могут все."
            : "Карточки, пароли и роли сотрудников ведёт администратор."}
        </p>
      </div>

      {isAdmin && (
        <p className="text-sm">
          <Link href="/visibility-log" className="text-gray-700 hover:underline">
            Журнал видимости
          </Link>
          <span className="text-gray-500">
            {" "}
            — кто и когда менял, какие записи идут в отчёт
          </span>
        </p>
      )}

      {isAdmin && <MemberForm action={createMember} />}

      {members.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          Справочник пуст. Сотрудники также заводятся автоматически при импорте из Excel.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {members.map((member) => (
            <li
              key={member.id}
              className={`card flex min-w-0 flex-col gap-3 p-4 ${member.isActive ? "" : "opacity-70"}`}
            >
              <div className="flex items-start gap-3">
                <Avatar name={member.fullName} />
                <div className="min-w-0 flex-1">
                  {isAdmin ? (
                    <MemberEditForm
                      member={{
                        id: member.id,
                        fullName: member.fullName,
                        displayName: member.displayName,
                        position: member.position,
                        email: member.email,
                      }}
                      action={updateMember}
                    />
                  ) : (
                    <p className="font-medium text-gray-900">{member.fullName}</p>
                  )}
                  <p className="truncate text-[13px] text-gray-500">
                    {[member.position, member.email].filter(Boolean).join(" · ") || "должность и почта не указаны"}
                  </p>
                </div>
                <div className="flex flex-none flex-wrap justify-end gap-1.5">
                  {member.role === "ADMIN" && <Pill tone="brand">Администратор</Pill>}
                  {!member.isActive && <Pill>В архиве</Pill>}
                </div>
              </div>

              <p className="text-[13px] text-gray-600">
                Открытых задач:{" "}
                <Link
                  href={`/tasks?assigneeId=${member.id}&view=list`}
                  className="font-medium text-gray-900 tabular-nums hover:underline"
                >
                  {openByMember.get(member.id) ?? 0}
                </Link>
                {member._count.ownedProjects > 0 && (
                  <> · руководит проектами: {member._count.ownedProjects}</>
                )}
              </p>

              {isAdmin && (
                <div className="flex flex-wrap items-start gap-2 border-t border-gray-200 pt-3">
                  <form action={toggleMemberRole}>
                    <input type="hidden" name="memberId" value={member.id} />
                    <SubmitButton className="btn-secondary" pendingLabel="…">
                      {member.role === "ADMIN" ? "Сделать участником" : "Сделать администратором"}
                    </SubmitButton>
                  </form>
                  {canArchive(member) && (
                    <form action={toggleMemberActive}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        {member.isActive ? "В архив" : "Вернуть из архива"}
                      </SubmitButton>
                    </form>
                  )}
                  <MemberAccess
                    memberId={member.id}
                    hasEmail={Boolean(member.email)}
                    hasPassword={Boolean(member.passwordHash)}
                    setPassword={setMemberPassword}
                  />
                  {member.passwordHash && member.id !== user.id && (
                    <form action={revokeMemberAccess}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        Закрыть вход
                      </SubmitButton>
                    </form>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
