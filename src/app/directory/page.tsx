import Link from "next/link";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Указатель по справочникам: вся справочная информация системы собрана в
 * одном месте, а не разбросана по подвалу и меню.
 */
export default async function DirectoryPage() {
  await requireUser();

  const [members, counterparties, contacts, tracks, pages] = await Promise.all([
    prisma.member.count({ where: { isActive: true } }),
    prisma.counterparty.count({ where: { isActive: true } }),
    prisma.orgContact.count({ where: { isActive: true } }),
    prisma.track.count({ where: { isArchived: false } }),
    prisma.referencePage.count(),
  ]);

  const cards = [
    {
      href: "/members",
      title: "Сотрудники",
      note: "Карточки, роли и доступ к системе",
      count: `${members} ${plural(members, "активный", "активных", "активных")}`,
      strip: "bg-blue-500",
      tile: "bg-blue-50 text-blue-600",
      icon: <PeopleIcon />,
    },
    {
      href: "/organizations",
      title: "Организации",
      note: "Варианты написания, чтобы одна организация не двоилась",
      count: `${counterparties} ${plural(counterparties, "организация", "организации", "организаций")}`,
      strip: "bg-orange-500",
      tile: "bg-orange-50 text-orange-600",
      icon: <BuildingIcon />,
    },
    {
      href: "/org-contacts",
      title: "Представители организаций",
      note: "Кто отвечает за вопрос на той стороне",
      count: `${contacts} ${plural(contacts, "представитель", "представителя", "представителей")}`,
      strip: "bg-violet-500",
      tile: "bg-violet-50 text-violet-600",
      icon: <ContactIcon />,
    },
    {
      href: "/tracks",
      title: "Треки работ",
      note: "Направления задач по проектам, цвет и порядок",
      count: `${tracks} ${plural(tracks, "трек", "трека", "треков")}`,
      strip: "bg-emerald-500",
      tile: "bg-emerald-50 text-emerald-600",
      icon: <TracksIcon />,
    },
    {
      href: "/reference",
      title: "Справочная информация",
      note: "Архитектура системы, паспорт проекта, матрица подписания",
      count: `${pages} ${plural(pages, "страница", "страницы", "страниц")}`,
      strip: "bg-sky-500",
      tile: "bg-sky-50 text-sky-600",
      icon: <BookIcon />,
    },
    {
      href: "/directory/vocabulary",
      title: "Виды и статусы",
      note: "Что означает каждый статус, вид и стадия в системе",
      count: "справка",
      strip: "bg-gray-400",
      tile: "bg-gray-100 text-gray-600",
      icon: <ListIcon />,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Справочники</h1>
        <p className="text-sm text-gray-500">
          Вся справочная информация системы: кто работает, с кем работаем и по каким правилам
        </p>
      </div>

      {/* По два блока в ряду: одиночного блока в конце ряда не бывает. */}
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card min-w-0 overflow-hidden p-0 transition hover:border-gray-300 hover:shadow-sm"
          >
            <span className={`block h-1 w-full ${card.strip}`} />
            <span className="flex items-start gap-3 p-5">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.tile}`}>
                {card.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-gray-900">{card.title}</span>
                <span className="block text-sm text-gray-500">{card.note}</span>
                <span className="mt-1 block text-xs text-gray-400">{card.count}</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const ICON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PeopleIcon() {
  return (
    <svg {...ICON}>
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.87M16 4.13A4 4 0 0 1 16 11" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg {...ICON}>
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <path d="M14 8h5a1 1 0 0 1 1 1v12M7 7h4M7 11h4M7 15h4M17 12h0M17 16h0" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg {...ICON}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="10" cy="11" r="2.5" />
      <path d="M6 17c.8-1.6 2.3-2.5 4-2.5s3.2.9 4 2.5M16 9h3M16 13h3" />
    </svg>
  );
}

function TracksIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 6h16M4 12h10M4 18h6" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M8 7h7M8 11h7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...ICON}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h0M4 12h0M4 18h0" />
    </svg>
  );
}
