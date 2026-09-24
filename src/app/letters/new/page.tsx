import Link from "next/link";
import { createLetter } from "@/app/actions/letters";
import { QuickLetterForm, type StickyLetterValues } from "@/components/quick-letter-form";
import { prisma } from "@/lib/db";
import { startOfToday, toDateInputValue } from "@/lib/domain";
import { requireUser } from "@/lib/auth";
import { VISIBILITY_DEFAULTS, visibilityValue } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function NewLetterPage(props: PageProps<"/letters/new">) {
  await requireUser();
  const params = await props.searchParams;
  // Срок и проект приходят из панели дня в календаре.
  const initialDueDate = /^\d{4}-\d{2}-\d{2}$/.test(single(params.dueDate) ?? "")
    ? (single(params.dueDate) as string)
    : "";
  const fromCalendar = single(params.projectId) ?? "";
  const [projects, counterparties, members, last, answerLetters] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    // Следующее письмо чаще всего похоже на предыдущее: подставляем его поля.
    prisma.letter.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        projectId: true,
        direction: true,
        counterpartyId: true,
        ownerId: true,
        isPublic: true,
      },
    }),
    // Кандидаты для поля «в ответ на»: ответить можно письмом любого
    // направления на письмо противоположного, поэтому берём оба. Форма сама
    // сузит список до проекта и нужного направления.
    prisma.letter.findMany({
      orderBy: { date: "desc" },
      select: {
        id: true,
        number: true,
        subject: true,
        projectId: true,
        direction: true,
        responseToId: true,
      },
      take: 400,
    }),
  ]);

  if (projects.length === 0) {
    return (
      <p className="card p-6 text-sm text-gray-500">
        Сначала создайте проект:{" "}
        <Link href="/projects/new" className="font-medium text-gray-900 hover:underline">
          новый проект
        </Link>
        .
      </p>
    );
  }

  const known = last && projects.some((project) => project.id === last.projectId) ? last : null;
  const sticky: StickyLetterValues = {
    projectId: projects.some((project) => project.id === fromCalendar)
      ? fromCalendar
      : (known?.projectId ?? projects[0].id),
    direction: known?.direction ?? "INCOMING",
    date: toDateInputValue(startOfToday()),
    counterpartyId:
      known?.counterpartyId && counterparties.some((item) => item.id === known.counterpartyId)
        ? known.counterpartyId
        : "",
    ownerId:
      known?.ownerId && members.some((item) => item.id === known.ownerId) ? known.ownerId : "",
    status: "IN_PROGRESS",
    // Пачку писем чаще всего заводят с одной видимостью: подставляем ту,
    // с которой завели предыдущее.
    visibility: visibilityValue(known?.isPublic ?? VISIBILITY_DEFAULTS.LETTER),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/letters" className="text-sm text-gray-500 hover:underline">
          ← Реестр писем ЭДО
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Внести письмо</h1>
        <p className="text-sm text-gray-500">
          Форма не закрывается после сохранения: проект, направление, дата, организация и
          ответственный остаются для следующего письма.
        </p>
      </div>
      <QuickLetterForm
        initialDueDate={initialDueDate}
        action={createLetter}
        projects={projects}
        counterparties={counterparties}
        members={members}
        answerLetters={answerLetters}
        sticky={sticky}
      />
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
