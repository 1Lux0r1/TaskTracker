import Link from "next/link";
import { Fragment } from "react";
import { DocumentStatusBadge } from "@/components/letter-badges";
import { FilterBar } from "@/components/filter-bar";
import { DueTag } from "@/components/ui";
import { BulkVisibility } from "@/components/bulk-visibility";
import { prisma } from "@/lib/db";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUSES,
  documentStageRank,
  documentKindLabel,
  documentStatusLabel,
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
import { FilterPresets } from "@/components/filter-presets";
import { presetContext } from "@/lib/filter-presets-db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const presets = await presetContext(user.id, "DOCUMENT", params);
  if (presets.redirectTo) redirect(presets.redirectTo);
  const filter = readDocumentFilter(params);
  const activeFilters = countActiveDocumentFilters(filter);

  const admin = user.role === "ADMIN";
  const [documents, counterparties, internalCount, total] = await Promise.all([
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
    prisma.document.count(),
  ]);

  // По стадиям список сортируется здесь: в базе статус хранится строкой,
  // и запрос выстроил бы стадии по алфавиту, а не по ходу работы.
  const ordered =
    filter.sort === "statusAsc"
      ? [...documents].sort((a, b) => documentStageRank(a.status) - documentStageRank(b.status))
      : documents;

  const declined = documents.filter((item) => item.status === "DECLINED").length;
  // Заголовок стадии ставится перед первым документом этой стадии: список
  // читается сверху вниз, от того, что горит, к законченному.
  const grouped = filter.sort === "statusAsc";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-[25px] leading-tight font-bold text-gray-900">Юридический трек</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
            Документы с несколькими подписывающими сторонами: список с фильтрами по виду и
            стадии. Подписи показаны точками, итог считается из матрицы сторон.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/api/export?entity=documents" className="btn-secondary">
            Выгрузить
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
        resetHref={presets.resetHref}
        activeCount={activeFilters}
        applied={presets.applied}
        presets={
          <FilterPresets scope="DOCUMENT" items={presets.items} appliedId={presets.appliedId ?? undefined} />
        }
        query={filter.query}
        placeholder="Поиск по названию, контрагенту, стадии"
        found={`Найдено: ${ordered.length} из ${total}`}
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

      {ordered.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Под фильтр ничего не подошло.</p>
      ) : (
        <BulkVisibility entity="DOCUMENT" enabled={admin}>
          {/* Реестр колонками, как в макете: подписи сторон — точками с
              числом подписавших, итоговая стадия — пилюлей справа. */}
          <div
            className="reg"
            style={
              {
                "--reg-cols": `${admin ? "18px " : ""}minmax(0,1fr) 110px 150px 96px 128px 96px 170px`,
              } as React.CSSProperties
            }
          >
            <div className="reg-head">
              {admin && <span />}
              <span>Документ</span>
              <span>Вид</span>
              <span>Контрагент</span>
              <span>Подписи</span>
              <span>Ответственный</span>
              <span>Срок</span>
              <span>Стадия</span>
            </div>
            {ordered.map((document, index) => {
              const closed = document.status === "SIGNED" || document.status === "FILED";
              const waiting = pendingParties(document.signatures);
              const declinedBy = document.signatures.filter((item) => item.status === "DECLINED");
              const newStage = grouped && ordered[index - 1]?.status !== document.status;
              const note =
                declinedBy.length > 0
                  ? `отказ: ${declinedBy.map((item) => item.party).join(", ")}`
                  : waiting.length > 0
                    ? `ждём: ${waiting.join(", ")}`
                    : null;
              return (
                <Fragment key={document.id}>
                  {/* При сортировке по стадиям перед первой записью стадии —
                      её название: список читается от того, что горит, к законченному. */}
                  {newStage && (
                    <div className="border-t border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-500">
                      {documentStatusLabel(document.status)}{" "}
                      <span className="font-normal tabular-nums">
                        {ordered.filter((item) => item.status === document.status).length}
                      </span>
                    </div>
                  )}
                  <div className="reg-row relative">
                    {admin && (
                      <input
                        type="checkbox"
                        name="ids"
                        value={document.id}
                        className="relative z-10 size-4"
                        aria-label={`Отметить документ «${document.title}»`}
                      />
                    )}
                    <span className="min-w-0">
                      <Link
                        href={`/documents/${document.id}`}
                        className="block truncate text-gray-900 after:absolute after:inset-0 after:content-['']"
                      >
                        {document.title}
                      </Link>
                      {(note || !document.isPublic) && (
                        <span
                          className={`block truncate text-xs ${
                            declinedBy.length > 0 ? "text-red-600" : "text-gray-500"
                          }`}
                        >
                          {[note, document.isPublic ? null : "служебный"].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="reg-cut">{documentKindLabel(document.kind)}</span>
                    <span className="reg-cut">{document.counterparty?.name ?? "—"}</span>
                    <SignatureDots signatures={document.signatures} />
                    <span className="reg-cut">{document.owner?.fullName ?? "—"}</span>
                    <DueTag date={document.dueDate} closed={closed} />
                    <span>
                      <DocumentStatusBadge status={document.status} />
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </BulkVisibility>
      )}
    </div>
  );
}

/** Подписи точками: зелёная — подписал, красная — отказ, серая — ждём. */
function SignatureDots({ signatures }: { signatures: { status: string }[] }) {
  const required = signatures.filter((item) => item.status !== "NOT_REQUIRED");
  if (required.length === 0) return <span className="text-xs text-gray-500">не заданы</span>;
  const signed = required.filter((item) => item.status === "SIGNED").length;
  return (
    <span
      className="flex items-center gap-1.5"
      title={`Подписали ${signed} из ${required.length}`}
    >
      <span className="flex gap-1">
        {required.map((item, index) => (
          <i
            key={index}
            className={`block size-2 rounded-full ${
              item.status === "SIGNED"
                ? "bg-green-600"
                : item.status === "DECLINED"
                  ? "bg-red-600"
                  : "bg-gray-300"
            }`}
          />
        ))}
      </span>
      <span className="font-mono text-xs text-gray-500">
        {signed}/{required.length}
      </span>
    </span>
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
