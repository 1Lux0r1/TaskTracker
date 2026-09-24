import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteLetter, updateLetter } from "@/app/actions/letters";
import { VisibilityBadge } from "@/components/badges";
import { DirectionBadge, LetterStatusBadge } from "@/components/letter-badges";
import { LetterForm } from "@/components/letter-form";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachments";
import { AttachmentPanel } from "@/components/attachment-panel";
import { NoteFeed } from "@/components/note-feed";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatFileSize } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { formatDate, isLetterOpen, startOfToday } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LetterPage(props: PageProps<"/letters/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: {
      notes: { include: { author: true }, orderBy: { occurredOn: "desc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      tasks: { include: { assignee: true }, orderBy: { number: "asc" } },
      // Связь «письмо — ответ» показывается с обеих сторон: у ответа видно,
      // на что он дан, у исходного письма — чем его закрыли.
      responses: { orderBy: { date: "asc" }, select: { id: true, number: true, date: true } },
      responseTo: true,
    },
  });

  if (!letter) notFound();

  const [projects, counterparties, members, answerLetters] = await Promise.all([
    prisma.project.findMany({
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
    // Кандидаты для поля «в ответ на»: ответить можно письмом любого
    // направления на письмо противоположного, поэтому берём оба.
    prisma.letter.findMany({
      orderBy: { date: "desc" },
      select: { id: true, number: true, subject: true, projectId: true, direction: true },
      take: 400,
    }),
  ]);

  const saveLetter = updateLetter.bind(null, letter.id);
  const overdue =
    letter.dueDate !== null && isLetterOpen(letter.status) && letter.dueDate < startOfToday();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/letters" className="text-sm text-gray-500 hover:underline">
          ← Переписка
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">№ {letter.number}</h1>
          <DirectionBadge direction={letter.direction} />
          <LetterStatusBadge status={letter.status} />
          <VisibilityBadge isPublic={letter.isPublic} />
        </div>
        <p className="mt-1 text-sm text-gray-600">{letter.subject}</p>
        {overdue && (
          <p className="mt-2 text-sm font-medium text-red-600">
            Просрочено: срок исполнения был {formatDate(letter.dueDate)}
          </p>
        )}
        {letter.responseTo && (
          <p className="mt-2 text-sm text-gray-500">
            Ответ на{" "}
            <Link href={`/letters/${letter.responseTo.id}`} className="text-gray-900 hover:underline">
              № {letter.responseTo.number}
            </Link>
          </p>
        )}
        {letter.responses.length > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            {letter.responses.length === 1 ? "Ответ дан письмом" : "Ответы даны письмами"}{" "}
            {letter.responses.map((response, index) => (
              <span key={response.id}>
                {index > 0 && ", "}
                <Link href={`/letters/${response.id}`} className="text-gray-900 hover:underline">
                  № {response.number}
                </Link>
                {response.date && ` от ${formatDate(response.date)}`}
              </span>
            ))}
          </p>
        )}
      </div>

      <LetterForm
        action={saveLetter}
        projects={projects}
        counterparties={counterparties}
        members={members}
        answerLetters={answerLetters}
        defaults={letter}
        canChangeVisibility={user.role === "ADMIN"}
        submitLabel="Сохранить"
      />

      {letter.tasks.length > 0 && (
        <section className="card space-y-2 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Задачи по письму</h2>
          <ul className="divide-y divide-gray-100">
            {letter.tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/tasks/${task.id}`} className="text-gray-900 hover:underline">
                  #{task.number} {task.title}
                </Link>
                <span className="text-gray-500">{task.assignee?.fullName ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AttachmentPanel
        attachments={letter.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          size: formatFileSize(attachment.size),
          uploadedBy: attachment.uploadedBy?.fullName ?? null,
          createdAt: formatDate(attachment.createdAt),
        }))}
        owner={{ field: "letterId", id: letter.id }}
        upload={uploadAttachment}
        remove={deleteAttachment}
      />

      <NoteFeed notes={letter.notes} members={members} letterId={letter.id} />

      <form action={deleteLetter} className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Удалить письмо</h2>
        <p className="text-sm text-gray-500">
          Хроника по письму удалится вместе с ним, задачи останутся. Действие необратимо.
        </p>
        <input type="hidden" name="letterId" value={letter.id} />
        <ConfirmSubmit>Удалить письмо</ConfirmSubmit>
      </form>
    </div>
  );
}
