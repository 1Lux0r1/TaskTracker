import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DOCUMENT_STATUS_LABELS,
  LETTER_DIRECTION_LABELS,
  LETTER_STATUS_LABELS,
  referenceSectionLabel,
  TASK_STATUS_LABELS,
} from "@/lib/domain";
import { normalizeQuery } from "@/lib/search";

const PER_KIND = 12;

type Found = {
  kind: string;
  href: string;
  title: string;
  note: string;
};

/**
 * Общий поиск из шапки: одним запросом по задачам, письмам, документам,
 * встречам и справочным страницам. Ищем по `searchIndex` — SQLite не
 * приводит кириллицу к нижнему регистру, поэтому строка готовится при записи.
 */
export default async function SearchPage({
  searchParams,
}: PageProps<"/search">): Promise<React.ReactElement> {
  await requireUser();
  const params = await searchParams;
  const raw = typeof params.q === "string" ? params.q : "";
  const query = normalizeQuery(raw);

  if (!raw.trim()) redirect("/");

  const groups = query ? await find(query) : [];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Поиск</h1>
        <p className="mt-1 text-sm text-gray-600">
          {total > 0 ? (
            <>
              По запросу «{raw.trim()}» найдено записей: {total}
            </>
          ) : (
            <>По запросу «{raw.trim()}» ничего не нашлось</>
          )}
        </p>
      </header>

      {total === 0 ? (
        <div className="card p-6 text-sm text-gray-600">
          Поиск идёт по названию, номеру, организации и комментариям. Попробуйте часть слова или
          номер письма.
        </div>
      ) : (
        <div className="space-y-5">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.caption} className="card card-accent overflow-hidden">
                <h2 className="border-b border-gray-200 px-4 pt-4 pb-3 text-base font-semibold">
                  {group.caption}
                  <span className="ml-2 font-mono text-sm font-normal text-gray-500">
                    {group.items.length}
                  </span>
                </h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href} className="border-b border-gray-200 last:border-b-0">
                      <Link href={item.href} className="block px-4 py-3 hover:bg-gray-50">
                        <span className="block text-sm text-gray-900">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{item.note}</span>
                      </Link>
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

async function find(query: string): Promise<{ caption: string; items: Found[] }[]> {
  const like = { contains: query };

  const [tasks, letters, documents, meetings, pages] = await Promise.all([
    prisma.task.findMany({
      where: { searchIndex: like },
      orderBy: { updatedAt: "desc" },
      take: PER_KIND,
      select: { id: true, title: true, status: true, dueDate: true, track: { select: { name: true } } },
    }),
    prisma.letter.findMany({
      where: { searchIndex: like },
      orderBy: { date: "desc" },
      take: PER_KIND,
      select: {
        id: true,
        number: true,
        subject: true,
        direction: true,
        status: true,
        counterparty: { select: { name: true } },
      },
    }),
    prisma.document.findMany({
      where: { searchIndex: like },
      orderBy: { updatedAt: "desc" },
      take: PER_KIND,
      select: {
        id: true,
        title: true,
        status: true,
        counterparty: { select: { name: true } },
      },
    }),
    prisma.meeting.findMany({
      where: { searchIndex: like },
      orderBy: { date: "desc" },
      take: PER_KIND,
      select: { id: true, subject: true, date: true, place: true },
    }),
    prisma.referencePage.findMany({
      where: { searchIndex: like },
      orderBy: { updatedAt: "desc" },
      take: PER_KIND,
      select: { id: true, title: true, section: true },
    }),
  ]);

  return [
    {
      caption: "Задачи",
      items: tasks.map((task) => ({
        kind: "task",
        href: `/tasks/${task.id}`,
        title: task.title,
        note: [
          task.track?.name,
          TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status,
          task.dueDate ? `срок ${formatDate(task.dueDate)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    },
    {
      caption: "Письма",
      items: letters.map((letter) => ({
        kind: "letter",
        href: `/letters/${letter.id}`,
        title: `№ ${letter.number} · ${letter.subject}`,
        note: [
          LETTER_DIRECTION_LABELS[letter.direction as keyof typeof LETTER_DIRECTION_LABELS] ??
            letter.direction,
          letter.counterparty?.name,
          LETTER_STATUS_LABELS[letter.status as keyof typeof LETTER_STATUS_LABELS] ?? letter.status,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    },
    {
      caption: "Документы",
      items: documents.map((document) => ({
        kind: "document",
        href: `/documents/${document.id}`,
        title: document.title,
        note: [
          document.counterparty?.name,
          DOCUMENT_STATUS_LABELS[document.status as keyof typeof DOCUMENT_STATUS_LABELS] ??
            document.status,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    },
    {
      caption: "Встречи",
      items: meetings.map((meeting) => ({
        kind: "meeting",
        href: `/meetings/${meeting.id}`,
        title: meeting.subject,
        note: [formatDate(meeting.date), meeting.place].filter(Boolean).join(" · "),
      })),
    },
    {
      caption: "Справочная информация",
      items: pages.map((page) => ({
        kind: "reference",
        href: `/reference/${page.id}`,
        title: page.title,
        note: referenceSectionLabel(page.section),
      })),
    },
  ];
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("ru-RU");
}
