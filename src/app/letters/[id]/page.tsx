import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteLetter, updateLetter } from "@/app/actions/letters";
import { VisibilityPill } from "@/components/badges";
import { DueTag, Pill, Prop, SectionCap, Who } from "@/components/ui";
import { LetterStatusBadge } from "@/components/letter-badges";
import { LetterForm } from "@/components/letter-form";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachments";
import { AttachmentPanel } from "@/components/attachment-panel";
import { NoteFeed } from "@/components/note-feed";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatFileSize } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { formatDate, isLetterOpen, letterDirectionLabel, startOfToday } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LetterPage(props: PageProps<"/letters/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const editing = (await props.searchParams).edit === "1";

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
      counterparty: true,
      owner: true,
      project: true,
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

  const saveLetter = updateLetter.bind(null, letter.id);
  const open = isLetterOpen(letter.status);
  const incoming = letter.direction === "INCOMING";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <Link href="/letters" className="text-sm text-gray-500 hover:underline">
            ← Реестр писем ЭДО · {letterDirectionLabel(letter.direction)} · № {letter.number}
          </Link>
          <h1 className="mt-1 text-[25px] leading-tight font-bold text-gray-900">{letter.subject}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <LetterStatusBadge status={letter.status} />
            {open && letter.dueDate && (
              <Pill tone={letter.dueDate < startOfToday() ? "bad" : "brand"}>
                {letter.dueDate < startOfToday() ? "просрочено" : "в срок"}
              </Pill>
            )}
            <VisibilityPill isPublic={letter.isPublic} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={deleteLetter}>
            <input type="hidden" name="letterId" value={letter.id} />
            <ConfirmSubmit question="Удалить письмо? Задачи по нему останутся.">Удалить</ConfirmSubmit>
          </form>
          <Link
            href={`/tasks/new?projectId=${letter.projectId}&letterId=${letter.id}`}
            className="btn-secondary"
          >
            Создать задачу
          </Link>
          {letter.url && (
            <a href={letter.url} target="_blank" rel="noreferrer" className="btn-secondary">
              Открыть в ЭДО
            </a>
          )}
          {editing ? (
            <Link href={`/letters/${letter.id}`} className="btn-secondary">
              Готово
            </Link>
          ) : (
            <Link href={`/letters/${letter.id}?edit=1`} className="btn-primary">
              Редактировать
            </Link>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {editing ? (
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
          ) : (
            <section className="card space-y-5 p-[18px]">
              <div className="grid grid-cols-2 gap-2.5">
                <Prop label={incoming ? "От кого" : "Кому"}>
                  {letter.counterparty?.name ?? <span className="text-gray-500">не указан</span>}
                </Prop>
                <Prop label="Дата">
                  <span className="font-mono">{formatDate(letter.date)}</span>
                </Prop>
                <Prop label="Ответственный">
                  <Who name={letter.owner?.fullName} empty={open ? "не назначен" : "—"} />
                </Prop>
                <Prop label="Контроль ответа">
                  <DueTag date={letter.dueDate} closed={!open} words />
                  {letter.dueDate && (
                    <span className="ml-1.5 text-xs text-gray-500">{formatDate(letter.dueDate)}</span>
                  )}
                </Prop>
                <Prop label={incoming ? "Резолюция" : "Подписант"}>
                  {(incoming ? letter.resolution : letter.signatory) ?? (
                    <span className="text-gray-500">не указан{incoming ? "а" : ""}</span>
                  )}
                </Prop>
                <Prop label="Внешний трекер">
                  {letter.externalTaskKey ? (
                    <span className="font-mono">{letter.externalTaskKey}</span>
                  ) : (
                    <span className="text-gray-500">не связано</span>
                  )}
                </Prop>
              </div>

              {(letter.statusNote || letter.responseRef || letter.comment) && (
                <div>
                  <SectionCap>Содержание</SectionCap>
                  <div className="space-y-1 text-sm text-gray-900">
                    {letter.statusNote && <p>Уточнение к статусу: {letter.statusNote}</p>}
                    {letter.responseRef && <p>Реквизиты ответа: {letter.responseRef}</p>}
                    {letter.comment && <p className="whitespace-pre-line">{letter.comment}</p>}
                  </div>
                </div>
              )}

              <div>
                <SectionCap>Связи</SectionCap>
                {/* Связь «письмо — ответ» показывается с обеих сторон: у ответа
                    видно, на что он дан, у исходного письма — чем его закрыли. */}
                {!letter.responseTo && letter.responses.length === 0 && letter.tasks.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет</p>
                ) : (
                  <ul className="space-y-1 text-sm text-gray-900">
                    {letter.responseTo && (
                      <li>
                        Ответ на{" "}
                        <Link href={`/letters/${letter.responseTo.id}`} className="text-brand hover:underline">
                          № {letter.responseTo.number}
                        </Link>
                      </li>
                    )}
                    {letter.responses.length > 0 && (
                      <li>
                        {letter.responses.length === 1 ? "Ответ дан письмом" : "Ответы даны письмами"}{" "}
                        {letter.responses.map((response, index) => (
                          <span key={response.id}>
                            {index > 0 && ", "}
                            <Link href={`/letters/${response.id}`} className="text-brand hover:underline">
                              № {response.number}
                            </Link>
                            {response.date && ` от ${formatDate(response.date)}`}
                          </span>
                        ))}
                      </li>
                    )}
                    {letter.tasks.map((task) => (
                      <li key={task.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                          Задача:{" "}
                          <Link href={`/tasks/${task.id}`} className="text-brand hover:underline">
                            #{task.number} {task.title}
                          </Link>
                        </span>
                        <Who name={task.assignee?.fullName} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
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
        </div>
      </div>
    </div>
  );
}
