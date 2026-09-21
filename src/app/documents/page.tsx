import Link from "next/link";
import { DocumentKindBadge, DocumentStatusBadge } from "@/components/letter-badges";
import { ProgressBar } from "@/components/badges";
import { prisma } from "@/lib/db";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUSES,
  formatDate,
  signatureProgress,
  type DocumentKind,
  type DocumentStatus,
} from "@/lib/domain";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const params = await props.searchParams;
  const kind = single(params.kind) ?? "";
  const status = single(params.status) ?? "";
  const counterpartyId = single(params.counterpartyId) ?? "";

  const where: Prisma.DocumentWhereInput = {};
  if (kind && DOCUMENT_KINDS.includes(kind as DocumentKind)) where.kind = kind;
  if (status && DOCUMENT_STATUSES.includes(status as DocumentStatus)) where.status = status;
  if (counterpartyId) where.counterpartyId = counterpartyId;

  const [documents, counterparties] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { counterparty: true, owner: true, signatures: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const declined = documents.filter((item) => item.status === "DECLINED").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Юридические документы</h1>
          <p className="text-sm text-gray-500">
            Регламенты, допсоглашения и контракты с подписанием по сторонам
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/api/export?entity=documents" className="btn-secondary">
            Выгрузить в Excel
          </Link>
          <Link href="/documents/new" className="btn-primary">
            Новый документ
          </Link>
        </div>
      </div>

      {declined > 0 && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Отказов в подписании: {declined}. По каждому нужна причина и план действий.
        </p>
      )}

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="field">
          Вид
          <select name="kind" defaultValue={kind} className="input w-48">
            <option value="">Любой</option>
            {DOCUMENT_KINDS.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Статус
          <select name="status" defaultValue={status} className="input w-52">
            <option value="">Любой</option>
            {DOCUMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Контрагент
          <select name="counterpartyId" defaultValue={counterpartyId} className="input w-56">
            <option value="">Все</option>
            {counterparties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary">
          Показать
        </button>
      </form>

      {documents.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Документов пока нет.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-4xl border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-head w-32">Вид</th>
                <th className="table-head">Документ</th>
                <th className="table-head w-48">Контрагент</th>
                <th className="table-head w-44">Статус</th>
                <th className="table-head w-40">Подписано сторон</th>
                <th className="table-head w-28">Срок</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((document) => (
                <tr key={document.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <DocumentKindBadge kind={document.kind} />
                  </td>
                  <td className="table-cell">
                    <Link
                      href={`/documents/${document.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {document.title}
                    </Link>
                    {document.nextAction && (
                      <p className="mt-0.5 text-xs text-gray-500">{document.nextAction}</p>
                    )}
                  </td>
                  <td className="table-cell">{document.counterparty?.name ?? "—"}</td>
                  <td className="table-cell">
                    <DocumentStatusBadge status={document.status} />
                    {document.statusNote && (
                      <p className="mt-0.5 text-xs text-gray-500">{document.statusNote}</p>
                    )}
                  </td>
                  <td className="table-cell">
                    <ProgressBar value={signatureProgress(document.signatures)} />
                  </td>
                  <td className="table-cell tabular-nums">{formatDate(document.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
