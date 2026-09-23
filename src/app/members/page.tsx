import Link from "next/link";
import { revokeMemberAccess, setMemberPassword, toggleMemberRole } from "@/app/actions/auth";
import { createMember, toggleMemberActive, updateMember } from "@/app/actions/members";
import { MemberAccess } from "@/components/member-access";
import { MemberEditForm } from "@/components/member-edit-form";
import { MemberForm } from "@/components/member-form";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Сотрудники</h1>
        <p className="text-sm text-gray-500">
          {isAdmin
            ? "Карточки, пароли и роли сотрудников ведёт администратор. Роли различаются только этим: работать с задачами, письмами и документами могут все."
            : "Карточки, пароли и роли сотрудников ведёт администратор."}
        </p>
      </div>

      {isAdmin && <MemberForm action={createMember} />}

      {members.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          Справочник пуст. Сотрудники также заводятся автоматически при импорте из Excel.
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-head">ФИО</th>
                <th className="table-head w-56">Должность</th>
                <th className="table-head w-56">Email</th>
                <th className="table-head w-36">Открытых задач</th>
                <th className="table-head w-32">Проектов</th>
                <th className="table-head w-40">Статус</th>
                {isAdmin && <th className="table-head w-44">Роль</th>}
                {isAdmin && <th className="table-head w-56">Доступ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => (
                <tr key={member.id} className={member.isActive ? "" : "text-gray-400"}>
                  <td className="table-cell font-medium text-gray-900">
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
                      member.fullName
                    )}
                  </td>
                  <td className="table-cell">{member.position ?? "—"}</td>
                  <td className="table-cell">{member.email ?? "—"}</td>
                  <td className="table-cell tabular-nums">{openByMember.get(member.id) ?? 0}</td>
                  <td className="table-cell tabular-nums">{member._count.ownedProjects}</td>
                  <td className="table-cell">
                    {canArchive(member) ? (
                      <form action={toggleMemberActive}>
                        <input type="hidden" name="memberId" value={member.id} />
                        <SubmitButton className="btn-secondary" pendingLabel="…">
                          {member.isActive ? "В архив" : "Вернуть"}
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {member.isActive ? "Активен" : "В архиве"}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="table-cell">
                      <form action={toggleMemberRole} className="flex items-center gap-2">
                        <input type="hidden" name="memberId" value={member.id} />
                        <span className={member.role === "ADMIN" ? "font-medium text-gray-900" : ""}>
                          {member.role === "ADMIN" ? "Администратор" : "Участник"}
                        </span>
                        <SubmitButton className="btn-secondary" pendingLabel="…">
                          {member.role === "ADMIN" ? "Снять" : "Назначить"}
                        </SubmitButton>
                      </form>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="table-cell">
                      <div className="space-y-1">
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
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
