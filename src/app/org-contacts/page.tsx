import Link from "next/link";
import {
  createOrgContact,
  toggleOrgContactActive,
  updateOrgContact,
} from "@/app/actions/org-contacts";
import { OrgContactForm } from "@/components/org-contact-form";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { normalizeQuery } from "@/lib/search";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrgContactsPage(props: PageProps<"/org-contacts">) {
  await requireUser();
  const params = await props.searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const showArchived = (Array.isArray(params.archived) ? params.archived[0] : params.archived) === "1";

  // Кириллицу SQLite не приводит к нижнему регистру, поэтому ищем по каждому
  // слову отдельно и сравниваем как есть и в исходном написании.
  const terms = normalizeQuery(query).split(" ").filter(Boolean).slice(0, 4);

  const [contacts, counterparties] = await Promise.all([
    prisma.orgContact.findMany({
      where: {
        ...(showArchived ? {} : { isActive: true }),
        ...(terms.length > 0
          ? {
              AND: terms.map((term) => ({
                OR: [
                  { fullName: { contains: term } },
                  { fullName: { contains: capitalize(term) } },
                  { position: { contains: term } },
                  { comment: { contains: term } },
                  { counterparty: { name: { contains: capitalize(term) } } },
                ],
              })),
            }
          : {}),
      },
      include: {
        counterparty: { select: { id: true, name: true } },
        _count: { select: { meetings: true } },
      },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const byOrganization = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const key = contact.counterparty.name;
    byOrganization.set(key, [...(byOrganization.get(key) ?? []), contact]);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/directory" className="text-sm text-gray-500 hover:underline">
          ← Справочники
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Ответственные представители организаций
        </h1>
        <p className="text-sm text-gray-500">
          Кто отвечает за вопрос на стороне организации. Пользователями системы они не
          являются: записи нужны, чтобы отмечать участников встреч и знать, к кому обращаться.
        </p>
      </div>

      {counterparties.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          Сначала заведите организации в{" "}
          <Link href="/organizations" className="font-medium text-gray-900 hover:underline">
            справочнике организаций
          </Link>
          .
        </p>
      ) : (
        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Новый представитель</h2>
          <OrgContactForm
            action={createOrgContact}
            counterparties={counterparties}
            submitLabel="Добавить"
          />
        </section>
      )}

      <form className="flex flex-wrap items-end gap-2">
        <label className="field">
          Поиск
          <input
            name="q"
            defaultValue={query}
            placeholder="ФИО, должность, организация"
            className="input w-64"
          />
        </label>
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <button type="submit" className="btn-secondary">
          Найти
        </button>
        <Link
          href={showArchived ? "/org-contacts" : "/org-contacts?archived=1"}
          className="btn-secondary"
        >
          {showArchived ? "Скрыть архив" : "Показать архив"}
        </Link>
      </form>

      <p className="text-sm text-gray-500">Представителей: {contacts.length}</p>

      {contacts.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          {query ? "Под запрос никто не подошёл." : "Представителей пока нет."}
        </p>
      ) : (
        <div className="space-y-4">
          {[...byOrganization.entries()].map(([organization, rows]) => (
            <section key={organization} className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">{organization}</h2>
              <ul className="space-y-2">
                {rows.map((contact) => (
                  <li key={contact.id} className={`card p-4 ${contact.isActive ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {contact.fullName}
                          {!contact.isActive && (
                            <span className="badge ml-2 bg-gray-100 text-gray-600">в архиве</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {[contact.position, contact.comment].filter(Boolean).join(" · ") ||
                            "должность не указана"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {[contact.phone, contact.email].filter(Boolean).join(" · ") ||
                            "контактов нет"}
                          {contact._count.meetings > 0 && ` · встреч: ${contact._count.meetings}`}
                        </p>
                      </div>
                      <form action={toggleOrgContactActive}>
                        <input type="hidden" name="contactId" value={contact.id} />
                        <SubmitButton className="btn-secondary" pendingLabel="…">
                          {contact.isActive ? "В архив" : "Вернуть"}
                        </SubmitButton>
                      </form>
                    </div>

                    <div className="mt-3">
                      <OrgContactForm
                        action={updateOrgContact}
                        counterparties={counterparties}
                        contact={{
                          id: contact.id,
                          counterpartyId: contact.counterpartyId,
                          fullName: contact.fullName,
                          position: contact.position,
                          email: contact.email,
                          phone: contact.phone,
                          comment: contact.comment,
                        }}
                        submitLabel="Сохранить"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** «моэк» → «Моэк»: в названиях организаций регистр как в справочнике. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
