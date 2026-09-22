import Link from "next/link";
import {
  createCounterparty,
  deleteCounterparty,
  restoreCounterparty,
  toggleInternalCounterparty,
} from "@/app/actions/organizations";
import { CounterpartyForm } from "@/components/counterparty-form";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  await requireUser();
  const counterparties = await prisma.counterparty.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      aliases: true,
      _count: { select: { letters: true, documents: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Организации</h1>
        <p className="text-sm text-gray-500">
          Служебный справочник: ведомства и организации, которым адресованы письма и которые
          подписывают документы. Пользователями системы они не являются — учёт внутренний.
          Варианты написания заводятся при импорте, чтобы одна организация не двоилась в
          отчётах. Свою организацию отметьте как нашу: по этой отметке видно, чьей подписи
          ждёт документ.
        </p>
      </div>

      <CounterpartyForm action={createCounterparty} />

      {counterparties.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Справочник пуст.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-head">Название</th>
                <th className="table-head w-40">Сокращение</th>
                <th className="table-head">Варианты написания</th>
                <th className="table-head w-24">Писем</th>
                <th className="table-head w-28">Документов</th>
                <th className="table-head w-40">Сторона</th>
                <th className="table-head w-36">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {counterparties.map((item) => (
                <tr key={item.id} className={item.isActive ? "" : "text-gray-400"}>
                  <td className="table-cell font-medium text-gray-900">
                    {item.name}
                    {item.isInternal && (
                      <span className="ml-2 rounded bg-gray-900 px-1.5 py-0.5 text-xs font-normal text-white">
                        наша
                      </span>
                    )}
                  </td>
                  <td className="table-cell">{item.shortName ?? "—"}</td>
                  <td className="table-cell text-xs text-gray-500">
                    {item.aliases.length === 0
                      ? "—"
                      : item.aliases.map((alias) => alias.alias).join(" · ")}
                  </td>
                  <td className="table-cell tabular-nums">
                    <Link
                      href={`/letters?counterpartyId=${item.id}&preset=all`}
                      className="hover:underline"
                    >
                      {item._count.letters}
                    </Link>
                  </td>
                  <td className="table-cell tabular-nums">
                    <Link href={`/documents?counterpartyId=${item.id}`} className="hover:underline">
                      {item._count.documents}
                    </Link>
                  </td>
                  <td className="table-cell">
                    <form action={toggleInternalCounterparty}>
                      <input type="hidden" name="counterpartyId" value={item.id} />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        {item.isInternal ? "Убрать отметку" : "Сделать нашей"}
                      </SubmitButton>
                    </form>
                  </td>
                  <td className="table-cell">
                    <form action={item.isActive ? deleteCounterparty : restoreCounterparty}>
                      <input type="hidden" name="counterpartyId" value={item.id} />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        {item.isActive ? "В архив" : "Вернуть"}
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
