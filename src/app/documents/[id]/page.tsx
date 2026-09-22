import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addSignature,
  deleteDocument,
  deleteSignature,
  setSignatureStatus,
  updateDocument,
} from "@/app/actions/documents";
import { DocumentKindBadge, DocumentStatusBadge, SignatureStatusBadge } from "@/components/letter-badges";
import { DocumentForm } from "@/components/document-form";
import { NoteFeed } from "@/components/note-feed";
import { SignatureForm } from "@/components/signature-form";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { SIGNATURE_STATUS_LABELS, SIGNATURE_STATUSES, formatDate } from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DocumentPage(props: PageProps<"/documents/[id]">) {
  await requireUser();
  const { id } = await props.params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      signatures: { include: { counterparty: true }, orderBy: { sortOrder: "asc" } },
      notes: { include: { author: true }, orderBy: { occurredOn: "desc" } },
      outgoingLetter: true,
      incomingLetter: true,
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/documents" className="text-sm text-gray-500 hover:underline">
          ← Документы
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{document.title}</h1>
          <DocumentKindBadge kind={document.kind} />
          <DocumentStatusBadge status={document.status} />
        </div>
        {document.signedAt && (
          <p className="mt-2 text-sm text-emerald-700">
            Подписан всеми сторонами {formatDate(document.signedAt)}
          </p>
        )}
      </div>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Стороны подписания</h2>
          <p className="mt-1 text-sm text-gray-500">
            У каждой стороны свой статус. Документ считается подписанным, только когда
            подписали все обязательные стороны; отказ любой из них блокирует документ.
          </p>
        </div>

        {document.signatures.length === 0 ? (
          <p className="text-sm text-gray-500">Стороны не заданы.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {document.signatures.map((signature) => (
              <li key={signature.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {signature.counterparty?.name ?? signature.party}
                    </p>
                    <p className="text-xs text-gray-500">
                      {signature.signedAt
                        ? `Подписано ${formatDate(signature.signedAt)}`
                        : "Подпись не проставлена"}
                      {signature.refusalReason && ` · Причина отказа: ${signature.refusalReason}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SignatureStatusBadge status={signature.status} />
                    {SIGNATURE_STATUSES.filter((value) => value !== signature.status).map((value) => (
                      <form key={value} action={setSignatureStatus}>
                        <input type="hidden" name="signatureId" value={signature.id} />
                        <input type="hidden" name="status" value={value} />
                        <button
                          type="submit"
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          {SIGNATURE_STATUS_LABELS[value]}
                        </button>
                      </form>
                    ))}
                    <form action={deleteSignature}>
                      <input type="hidden" name="signatureId" value={signature.id} />
                      <button
                        type="submit"
                        className="text-xs text-gray-400 hover:text-red-600"
                        title="Убрать сторону"
                      >
                        убрать
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <SignatureForm
          action={addSignature}
          documentId={document.id}
          counterparties={counterparties}
        />
      </section>

      <DocumentForm
        action={saveDocument}
        projects={projects}
        counterparties={counterparties}
        members={members}
        letters={letters}
        defaults={document}
        statusDerived={document.signatures.length > 0}
        submitLabel="Сохранить"
      />

      {(document.outgoingLetter || document.incomingLetter) && (
        <section className="card space-y-2 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Письма-основания</h2>
          <ul className="space-y-1 text-sm">
            {document.outgoingLetter && (
              <li>
                Направлен письмом{" "}
                <Link
                  href={`/letters/${document.outgoingLetter.id}`}
                  className="text-gray-900 hover:underline"
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
                  className="text-gray-900 hover:underline"
                >
                  № {document.incomingLetter.number}
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <NoteFeed notes={document.notes} members={members} documentId={document.id} />

      <form action={deleteDocument} className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Удалить документ</h2>
        <p className="text-sm text-gray-500">
          Стороны подписания и хроника удалятся вместе с ним. Действие необратимо.
        </p>
        <input type="hidden" name="documentId" value={document.id} />
        <SubmitButton className="btn-danger" pendingLabel="Удаляем…">
          Удалить документ
        </SubmitButton>
      </form>
    </div>
  );
}
