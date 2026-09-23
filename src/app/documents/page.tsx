import Link from "next/link";
import { DocumentKindBadge, DocumentStatusBadge } from "@/components/letter-badges";
import { FilterBar } from "@/components/filter-bar";
import { ProgressBar, VisibilityBadge } from "@/components/badges";
import { BulkVisibility } from "@/components/bulk-visibility";
import { prisma } from "@/lib/db";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUSES,
  documentStageRank,
  documentStatusLabel,
  formatDate,
  signatureProgress,
  startOfToday,
} from "@/lib/domain";
import {
  DOCUMENT_SORTS,
  DOCUMENT_WAITING,
  buildDocumentOrderBy,
  buildDocumentWhere,
  countActiveDocumentFilters,
  readDocumentFilter,
} from "@/lib/document-filters";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const filter = readDocumentFilter(params);
  const activeFilters = countActiveDocumentFilters(filter);

  const [documents, counterparties, internalCount] = await Promise.all([
    prisma.document.findMany({
      where: buildDocumentWhere(filter),
      include: {
        counterparty: true,
        owner: true,
        signatures: { include: { counterparty: { select: { isInternal: true } } } },
      },
      orderBy: buildDocumentOrderBy(filter.sort),
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.counterparty.count({ where: { isInternal: true } }),
  ]);

  // По стадиям список сортируется здесь: в базе статус хранится строкой,
  // и запрос выстроил бы стадии по алфавиту, а не по ходу работы.
  const ordered =
    filter.sort === "statusAsc"
      ? [...documents].sort((a, b) => documentStageRank(a.status) - documentStageRank(b.status))
      : documents;

  const declined = documents.filter((item) => item.status === "DECLINED").length;
  const today = startOfToday();
  // Заголовок стадии ставится перед первым документом этой стадии: список
  // читается сверху вниз, от того, что горит, к законченному.
  const grouped = filter.sort === "statusAsc";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Юридический трек</h1>
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

      {internalCount === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Чтобы выборка «ждут нашей подписи» работала, отметьте свою организацию
          в{" "}
          <Link href="/organizations" className="underline">
            справочнике организаций
          </Link>
          : остальные стороны подписания считаются внешними.
        </p>
      )}

      {declined > 0 && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Отказов в подписании: {declined}. По каждому нужна причина и план действий.
        </p>
      )}

      <FilterBar
        resetHref="/documents"
        activeCount={activeFilters}
        query={filter.query}
        placeholder="название, организация, стадия"
      >
        <label className="field">
          Вид
          <select name="kind" defaultValue={filter.kind} className="input">
            <option value="">Любой</option>
            {DOCUMENT_KINDS.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_KIND_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Стадия
          <select name="status" defaultValue={filter.status} className="input">
            <option value="">Любая</option>
            {DOCUMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ждём
          <select name="waiting" defaultValue={filter.waiting} className="input">
            {DOCUMENT_WAITING.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Организация
          <select name="counterpartyId" defaultValue={filter.counterpartyId} className="input">
            <option value="">Все</option>
            {counterparties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Порядок
          <select name="sort" defaultValue={filter.sort} className="input">
            {DOCUMENT_SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>

      <p className="text-sm text-gray-500">Документов: {ordered.length}</p>

      {ordered.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Под фильтр ничего не подошло.</p>
      ) : (
        <BulkVisibility entity="DOCUMENT" enabled={user.role === "ADMIN"}>
        <ul className="space-y-2">
          {ordered.map((document, index) => {
            const overdue =
              document.dueDate !== null &&
              document.status !== "SIGNED" &&
              document.status !== "FILED" &&
              document.dueDate < today;
            const waiting = pendingParties(document.signatures);
            const newStage = grouped && ordered[index - 1]?.status !== document.status;

            return (
              <li key={document.id}>
                {newStage && (
                  <h2 className="mt-4 mb-2 text-sm font-semibold text-gray-500 first:mt-0">
                    {documentStatusLabel(document.status)}
                    <span className="ml-2 font-normal text-gray-400 tabular-nums">
                      {ordered.filter((item) => item.status === document.status).length}
                    </span>
                  </h2>
                )}

                {/* Отметка живёт рядом с карточкой, а не внутри ссылки:
                    иначе щелчок по ней уводил бы на документ. */}
                <div className="flex items-start gap-2">
                {user.role === "ADMIN" && (
                  <input
                    type="checkbox"
                    name="ids"
                    value={document.id}
                    className="mt-5 size-4 shrink-0"
                  />
                )}
                <Link
                  href={`/documents/${document.id}`}
                  className="card block min-w-0 flex-1 p-4 transition hover:border-gray-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{document.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {document.counterparty?.name ?? "Без организации"}
                        {document.owner && ` · ${document.owner.fullName}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <DocumentKindBadge kind={document.kind} />
                      <DocumentStatusBadge status={document.status} />
                      <VisibilityBadge isPublic={document.isPublic} />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <ProgressBar value={signatureProgress(document.signatures)} />
                      <p className="mt-1 text-xs text-gray-500">
                        {waiting.length > 0 ? `Ждём: ${waiting.join(", ")}` : "Все стороны отметились"}
                      </p>
                    </div>
                    <div className="text-sm sm:text-right">
                      {document.dueDate && (
                        <p className={overdue ? "font-medium text-red-600" : "text-gray-600"}>
                          Срок {formatDate(document.dueDate)}
                          {overdue && " — просрочен"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Формулировки из таблицы бывают в абзац длиной: показываем
                      начало, целиком читается в карточке документа. */}
                  {(document.nextAction || document.statusNote) && (
                    <p className="mt-2 line-clamp-2 text-xs text-gray-500">
                      {[document.nextAction, document.statusNote].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </Link>
                </div>
              </li>
            );
          })}
        </ul>
        </BulkVisibility>
      )}
    </div>
  );
}

/**
 * Кого ждём поимённо. Название стороны полезнее категории: «ждём ДЖКХ» сразу
 * говорит, к кому идти, а «ждём третью сторону» требует открыть документ.
 */
function pendingParties(
  signatures: { party: string; status: string; counterparty: { isInternal: boolean } | null }[],
): string[] {
  return signatures
    .filter((item) => item.status === "PENDING")
    .map((item) => (item.counterparty?.isInternal ? `${item.party} (мы)` : item.party));
}
