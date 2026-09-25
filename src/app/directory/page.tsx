import Link from "next/link";
import { prisma } from "@/lib/db";
import { plural, referenceSectionLabel, trackColor } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Справочники — рабочий экран, а не указатель со ссылками: всё, что нужно
 * новому человеку на проекте, видно сразу. Наверху реестр представителей
 * контрагентов, ниже парами — справочная информация и контрагенты, участники
 * и треки. Полные карточки с правкой остаются на своих страницах.
 */
export default async function DirectoryPage() {
  await requireUser();

  const [contacts, pages, counterparties, members, tracks] = await Promise.all([
    prisma.orgContact.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      take: 40,
      include: { counterparty: { select: { name: true } } },
    }),
    prisma.referencePage.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      take: 12,
      include: { author: { select: { fullName: true } } },
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        isInternal: true,
        _count: { select: { letters: true, documents: true, contacts: true } },
      },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        position: true,
        role: true,
        _count: { select: { assignedTasks: true } },
      },
    }),
    prisma.track.findMany({
      where: { isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
        project: { select: { code: true } },
        _count: { select: { tasks: true } },
      },
    }),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Справочники</h1>
        <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
          Вся справочная информация по проекту и контрагентам: представители, документы проекта,
          участники, треки и список контрагентов.
        </p>
      </div>

      <section className="card card-accent mb-3.5 overflow-hidden">
        <CardHead
          title="Ответственные представители контрагентов"
          note={`${contacts.length} ${plural(contacts.length, "контакт", "контакта", "контактов")}, к которым обращаются по письмам и подписанию`}
          action={{ href: "/org-contacts", label: "Добавить представителя" }}
        />
        {contacts.length === 0 ? (
          <p className="px-4.5 pb-4.5 text-sm text-gray-500">
            Представителей пока нет. Они заводятся на странице справочника.
          </p>
        ) : (
          <div
            className="reg rounded-none border-0"
            style={{ ["--reg-cols" as string]: "186px 176px minmax(0,1fr) 154px 190px minmax(0,1fr)" }}
          >
            <div className="reg-head">
              <span>ФИО</span>
              <span>Контрагент</span>
              <span>Должность</span>
              <span>Телефон</span>
              <span>Почта</span>
              <span>Закреплено</span>
            </div>
            {contacts.map((contact) => (
              <Link key={contact.id} href="/org-contacts" className="reg-row">
                <span className="truncate text-gray-900">{contact.fullName}</span>
                <span className="reg-cut">{contact.counterparty.name}</span>
                <span className="reg-cut">{contact.position ?? "—"}</span>
                <span className="reg-cut font-mono text-[12.5px]">{contact.phone ?? "—"}</span>
                <span className="reg-cut">{contact.email ?? "—"}</span>
                <span className="reg-cut">{contact.comment ?? "—"}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mb-3.5 grid gap-3.5 lg:grid-cols-2">
        <section className="card card-accent overflow-hidden" style={accent("--color-purple-600")}>
          <CardHead
            title="Справочная информация по проекту"
            note="Всё, что нужно новому человеку на проекте"
            action={{ href: "/reference/new", label: "Добавить" }}
          />
          <List
            empty="Страниц пока нет."
            items={pages.map((page) => ({
              id: page.id,
              href: `/reference/${page.id}`,
              title: page.title,
              note: page.author ? `ведёт ${page.author.fullName}` : "без ответственного",
              right: (
                <span className="badge bg-gray-100 text-gray-600">
                  {referenceSectionLabel(page.section)}
                </span>
              ),
            }))}
          />
        </section>

        <section className="card card-accent overflow-hidden" style={accent("--color-copper")}>
          <CardHead
            title="Контрагенты"
            note="Адресаты писем и стороны подписания; список пополняется из формы письма"
            action={{ href: "/organizations", label: "Открыть" }}
          />
          <div className="flex flex-wrap gap-[7px] px-4.5 pb-4.5">
            {counterparties.length === 0 && (
              <span className="text-sm text-gray-500">Контрагентов пока нет.</span>
            )}
            {counterparties.map((item) => {
              const records = item._count.letters + item._count.documents;
              return (
                <span key={item.id} className="fchip cursor-default">
                  {item.name}
                  <span className="fchip-n">
                    {item.isInternal
                      ? "наша сторона"
                      : `${records}${item._count.contacts > 0 ? ` · ${item._count.contacts} предст.` : ""}`}
                  </span>
                </span>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className="card card-accent overflow-hidden" style={accent("--color-green-600")}>
          <CardHead
            title="Участники проекта"
            note="Роли и нагрузка"
            action={{ href: "/members", label: "Открыть" }}
          />
          <List
            empty="Сотрудников пока нет."
            items={members.map((member) => ({
              id: member.id,
              href: "/members",
              title: member.fullName,
              note: member.position ?? "должность не указана",
              right: (
                <>
                  <span
                    className={`badge ${
                      member.role === "ADMIN"
                        ? "bg-brand-soft text-brand"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {member.role === "ADMIN" ? "Администратор" : "Участник"}
                  </span>
                  <span className="text-[13px] whitespace-nowrap text-gray-500">
                    {member._count.assignedTasks}{" "}
                    {plural(member._count.assignedTasks, "задача", "задачи", "задач")}
                  </span>
                </>
              ),
            }))}
          />
        </section>

        <section className="card card-accent overflow-hidden">
          <CardHead
            title="Треки работ"
            note="Свои треки можно заводить: они появятся в задачах и фильтрах"
            action={{ href: "/tracks", label: "Новый трек" }}
          />
          <List
            empty="Треков пока нет."
            items={tracks.map((track) => ({
              id: track.id,
              href: "/tracks",
              title: track.name,
              // Треки свои у каждого проекта, поэтому имя повторяется: код
              // проекта рядом показывает, чей это трек.
              note: `${track.project.code} · ${track.key ? "из Excel" : "заведён вручную"}`,
              dot: trackColor(track.color).dot,
              right: (
                <span className="text-[13px] whitespace-nowrap text-gray-500">
                  {track._count.tasks} {plural(track._count.tasks, "задача", "задачи", "задач")}
                </span>
              ),
            }))}
          />
        </section>
      </div>

      {/* Полные карточки с правкой — на своих страницах, отсюда ссылки. */}
      <p className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-gray-500">
        Открыть целиком:
        <Link href="/members" className="hover:text-gray-900 hover:underline">
          сотрудники
        </Link>
        <Link href="/organizations" className="hover:text-gray-900 hover:underline">
          организации и написания
        </Link>
        <Link href="/org-contacts" className="hover:text-gray-900 hover:underline">
          представители
        </Link>
        <Link href="/tracks" className="hover:text-gray-900 hover:underline">
          треки
        </Link>
        <Link href="/reference" className="hover:text-gray-900 hover:underline">
          справочная информация
        </Link>
        <Link href="/directory/vocabulary" className="hover:text-gray-900 hover:underline">
          виды и статусы
        </Link>
      </p>
    </div>
  );
}

/** Цветная полоса карточки: она же задаёт цвет значка в шапке. */
function accent(token: string): React.CSSProperties {
  return { ["--accent" as string]: `var(${token})` };
}

function CardHead({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-start gap-3 px-4.5 pt-4.5 pb-3.5">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[15.5px] font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-[13px] text-gray-500">{note}</p>
      </div>
      <Link href={action.href} className="btn-secondary flex-none px-2.5 py-1">
        {action.label}
      </Link>
    </div>
  );
}

type ListItem = {
  id: string;
  href: string;
  title: string;
  note: string;
  /** Цветная метка трека слева от названия. */
  dot?: string;
  right?: React.ReactNode;
};

function List({ items, empty }: { items: ListItem[]; empty: string }) {
  if (items.length === 0) {
    return <p className="px-4.5 pb-4.5 text-sm text-gray-500">{empty}</p>;
  }

  return (
    <ul className="border-t border-gray-200">
      {items.map((item) => (
        <li key={item.id} className="border-b border-gray-200 last:border-b-0">
          <Link href={item.href} className="flex items-center gap-3.5 px-4.5 py-3 hover:bg-gray-50">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                {item.dot && <span aria-hidden className={`size-2 flex-none rounded-full ${item.dot}`} />}
                <span className="truncate text-[14.5px] text-gray-900">{item.title}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-gray-500">{item.note}</span>
            </span>
            {item.right && <span className="flex flex-none items-center gap-2.5">{item.right}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
