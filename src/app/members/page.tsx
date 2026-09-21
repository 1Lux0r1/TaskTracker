import { createMember, toggleMemberActive } from "@/app/actions/members";
import { MemberForm } from "@/components/member-form";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { CLOSED_TASK_STATUSES } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Сотрудники</h1>

      <MemberForm action={createMember} />

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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => (
                <tr key={member.id} className={member.isActive ? "" : "text-gray-400"}>
                  <td className="table-cell font-medium text-gray-900">{member.fullName}</td>
                  <td className="table-cell">{member.position ?? "—"}</td>
                  <td className="table-cell">{member.email ?? "—"}</td>
                  <td className="table-cell tabular-nums">{openByMember.get(member.id) ?? 0}</td>
                  <td className="table-cell tabular-nums">{member._count.ownedProjects}</td>
                  <td className="table-cell">
                    <form action={toggleMemberActive}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        {member.isActive ? "В архив" : "Вернуть"}
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
