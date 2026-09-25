import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addSignature,
  deleteDocument,
  deleteSignature,
  setSignatureStatus,
  updateDocument,
} from "@/app/actions/documents";
import { VisibilityPill } from "@/components/badges";
import { DueTag, Prop, SectionCap, Who } from "@/components/ui";
import { DocumentStatusBadge, SignatureStatusBadge } from "@/components/letter-badges";
import { DocumentForm } from "@/components/document-form";
import { deleteAttachment, uploadAttachment } from "@/app/actions/attachments";
import { AttachmentPanel } from "@/components/attachment-panel";
import { NoteFeed } from "@/components/note-feed";
import { SignatureForm } from "@/components/signature-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatFileSize } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import {
  SIGNATURE_STATUS_LABELS,
  SIGNATURE_STATUSES,
  documentKindLabel,
  formatDate,
  plural,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DocumentPage(props: PageProps<"/documents/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const editing = (await props.searchParams).edit === "1";

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      signatures: { include: { counterparty: true }, orderBy: { sortOrder: "asc" } },
      notes: { include: { author: true }, orderBy: { occurredOn: "desc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      outgoingLetter: true,
      incomingLetter: true,
      counterparty: true,
      owner: true,
    },
  });

  if (!document) notFound();

  const [projects, counterparties, members, letters] = await Promise.all([
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
    prisma.letter.findMany({
      where: { projectId: document.projectId },
      orderBy: { date: "desc" },
      select: { id: true, number: true, direction: true, subject: true },
      take: 300,
    }),
  ]);

  const saveDocument = updateDocument.bind(null, document.id);
  const required = document.signatures.filter((item) => item.status !== "NOT_REQUIRED");
  const signedCount = required.filter((item) => item.status === "SIGNED").length;
  const name = (item: (typeof document.signatures)[number]) => item.counterparty?.name ?? item.party;
  const waiting = required.filter((item) => item.status === "PENDING").map(name);
  const declined = required.filter((item) => item.status === "DECLINED").map(name);
  const closed = ["SIGNED", "FILED", "DECLINED"].includes(document.status);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <Link href="/documents" className="text-sm text-gray-500 hover:underline">
            ← Юридический трек · {documentKindLabel(document.kind)}
          </Link>
          <h1 className="mt-1 text-[25px] leading-tight font-bold text-gray-900">{document.title}</h1>
          {document.counterparty && (
            <p className="mt-1 text-sm text-gray-600">{document.counterparty.name}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={deleteDocument}>
            <input type="hidden" name="documentId" value={document.id} />
            <ConfirmSubmit question="Удалить документ со сторонами и хроникой?">Удалить</ConfirmSubmit>
          </form>
          {editing ? (
            <Link href={`/documents/${document.id}`} className="btn-secondary">
              Готово
            </Link>
          ) : (
            <Link href={`/documents/${document.id}?edit=1`} className="btn-primary">
              Редактировать
            </Link>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <section className="card space-y-4 p-[18px]">
            {/* Итог считается из матрицы сторон: у каждой свой статус, отказ
                любой обязательной стороны блокирует документ. */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="grid size-9 flex-none place-items-center rounded-full font-mono text-sm font-semibold"
                style={{
                  background: `conic-gradient(var(--color-green-600) ${
                    required.length ? (signedCount / required.length) * 360 : 0
                  }deg, var(--color-gray-200) 0)`,
                }}
              >
                <span className="grid size-7 place-items-center rounded-full bg-white">{signedCount}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">
                  {required.length === 0
                    ? "Стороны подписания не заданы"
                    : `${signedCount} из ${required.length} ${plural(required.length, "подписи", "подписей", "подписей")}`}
                </p>
                <p className="text-[13px] text-gray-500">
                  {declined.length > 0 ? (
                    <span className="text-red-600">отказ: {declined.join(", ")}</span>
                  ) : waiting.length > 0 ? (
                    `ждём: ${waiting.join(", ")}`
                  ) : document.signedAt ? (
                    `подписан всеми сторонами ${formatDate(document.signedAt)}`
                  ) : (
                    "итог считается из статусов сторон"
                  )}
                </p>
              </div>
              <DocumentStatusBadge status={document.status} />
            </div>

            <div>
              <SectionCap>Стороны</SectionCap>
              {document.signatures.length === 0 ? (
                <p className="text-sm text-gray-500">Стороны не заданы.</p>
              ) : (
                <ul className="divide-y divide-gray-200 border-y border-gray-200">
                  {document.signatures.map((signature) => (
                    <li key={signature.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{name(signature)}</p>
                        <p className="text-xs text-gray-500">
                          {signature.signedAt
                            ? `подписано ${formatDate(signature.signedAt)}`
                            : "подпись не проставлена"}
                          {signature.refusalReason && ` · причина отказа: ${signature.refusalReason}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SignatureStatusBadge status={signature.status} />
                        {SIGNATURE_STATUSES.filter((value) => value !== signature.status).map((value) => (
                          <form key={value} action={setSignatureStatus}>
                            <input type="hidden" name="signatureId" value={signature.id} />
                            <input type="hidden" name="status" value={value} />
                            <button
                              type="submit"
                              className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-600 hover:border-brand hover:text-brand"
                            >
                              {SIGNATURE_STATUS_LABELS[value]}
                            </button>
                          </form>
                        ))}
                        <form action={deleteSignature}>
                          <input type="hidden" name="signatureId" value={signature.id} />
                          <ConfirmSubmit
                            className="px-1 text-xs text-gray-500 hover:text-red-600"
                            question="Убрать сторону?"
                            confirmLabel="да"
                            pendingLabel="…"
                          >
                            убрать
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <SignatureForm
                  action={addSignature}
                  documentId={document.id}
                  counterparties={counterparties}
                />
              </div>
            </div>

            {editing ? null : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <Prop label="Ответственный">
                    <Who name={document.owner?.fullName} empty={closed ? "—" : "не назначен"} />
                  </Prop>
                  <Prop label="Срок">
                    <DueTag date={document.dueDate} closed={closed} words />
                    {document.dueDate && (
                      <span className="ml-1.5 text-xs text-gray-500">{formatDate(document.dueDate)}</span>
                    )}
                  </Prop>
                  <Prop label="Контрагент">
                    {document.counterparty?.name ?? <span className="text-gray-500">не указан</span>}
                  </Prop>
                  <Prop label="Видимость">
                    <VisibilityPill isPublic={document.isPublic} />
                  </Prop>
                </div>

                {(document.nextAction || document.statusNote) && (
                  <div>
                    <SectionCap>Следующий шаг</SectionCap>
                    {document.nextAction && <p className="text-sm text-gray-900">{document.nextAction}</p>}
                    {document.statusNote && <p className="text-sm text-gray-600">{document.statusNote}</p>}
                  </div>
                )}

                <div>
                  <SectionCap>Письма-основания</SectionCap>
                  {!document.outgoingLetter && !document.incomingLetter ? (
                    <p className="text-sm text-gray-500">Не связаны</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-gray-900">
                      {document.outgoingLetter && (
                        <li>
                          Направлен письмом{" "}
                          <Link
                            href={`/letters/${document.outgoingLetter.id}`}
                            className="text-brand hover:underline"
                          >
                            № {document.outgoingLetter.number}
                          </Link>
                        </li>
                      )}
                      {document.incomingLetter && (
                        <li>
                          Ответ получен письмом{" "}
                          <Link
                            href={`/letters/${document.incomingLetter.id}`}
                            className="text-brand hover:underline"
                          >
                            № {document.incomingLetter.number}
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>

          {editing && (
            <DocumentForm
              action={saveDocument}
              projects={projects}
              counterparties={counterparties}
              members={members}
              letters={letters}
              defaults={document}
              canChangeVisibility={user.role === "ADMIN"}
              statusDerived={document.signatures.length > 0}
              submitLabel="Сохранить"
            />
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <AttachmentPanel
            attachments={document.attachments.map((attachment) => ({
              id: attachment.id,
              fileName: attachment.fileName,
              size: formatFileSize(attachment.size),
              uploadedBy: attachment.uploadedBy?.fullName ?? null,
              createdAt: formatDate(attachment.createdAt),
            }))}
            owner={{ field: "documentId", id: document.id }}
            upload={uploadAttachment}
            remove={deleteAttachment}
          />

          <NoteFeed notes={document.notes} members={members} documentId={document.id} />
        </div>
      </div>
    </div>
  );
}
