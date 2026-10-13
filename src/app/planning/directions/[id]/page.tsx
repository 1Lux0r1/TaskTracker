import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePlanDirection, updatePlanDirection } from "@/app/actions/planning";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/planning/action-form";
import { DirectionFields } from "@/components/planning/direction-fields";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/domain";
import { buildCipher } from "@/lib/planning/cipher";
import { param } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

export default async function DirectionPage(props: PageProps<"/planning/directions/[id]">) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const direction = await prisma.planDirection.findUnique({
    where: { id },
    include: {
      system: true,
      parts: {
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        include: { _count: { select: { dks: true } } },
      },
    },
  });
  if (!direction) notFound();

  const oft = buildCipher({ system: direction.system.code, direction: direction.code });

  return (
    <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ActionForm action={updatePlanDirection} className="card p-5">
        <Link href="/planning" className="text-sm text-gray-500 hover:underline">
          ← Направления
        </Link>
        <div className="mt-1 mb-4">
          <span className="font-mono text-sm text-gray-500">ОФТ {oft}</span>
          <h2 className="font-display text-xl font-semibold text-gray-900">{direction.name}</h2>
        </div>
        <DirectionFields defaults={direction} />
        <div className="mt-4">
          <SubmitButton>Сохранить</SubmitButton>
        </div>
      </ActionForm>

      <aside className="space-y-3.5">
        <section className="card p-4.5">
          <h3 className="font-display text-[15px] font-semibold text-gray-900">Части направления</h3>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Пара «направление + часть» — блок дорожной карты. Части ведутся в справочниках.
          </p>
          <ul className="mt-3 space-y-1.5">
            {direction.parts.length === 0 && <li className="text-sm text-gray-500">Частей пока нет.</li>}
            {direction.parts.map((part) => (
              <li key={part.id} className="flex items-center gap-2 text-sm">
                <span className="badge bg-gray-100 font-mono text-gray-700">{part.code}</span>
                <span className="min-w-0 flex-1 truncate text-gray-800">{part.name}</span>
                <span className="text-[12.5px] text-gray-500">
                  {part._count.dks} {plural(part._count.dks, "ДК", "ДК", "ДК")}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/planning/directory#parts" className="btn-secondary mt-3 w-full">
            Части в справочниках
          </Link>
        </section>

        <section className="card p-4.5">
          <h3 className="font-display text-[15px] font-semibold text-gray-900">Удаление</h3>
          {param(search, "error") === "parts" && (
            <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              У направления есть части: сначала удалите их в справочниках.
            </p>
          )}
          <p className="mt-1 mb-3 text-[13px] text-gray-500">
            Удалить можно направление без частей.
          </p>
          <form action={deletePlanDirection}>
            <input type="hidden" name="id" value={direction.id} />
            <ConfirmSubmit question="Удалить направление?">Удалить направление</ConfirmSubmit>
          </form>
        </section>
      </aside>
    </div>
  );
}
