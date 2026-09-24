import type { Prisma } from "@/generated/prisma/client";
import {
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  type DocumentKind,
  type DocumentStatus,
} from "@/lib/domain";
import { normalizeQuery } from "@/lib/search";

/**
 * Разбор фильтров юридического трека. Как у переписки и задач: поиск на виду,
 * остальные условия под одной кнопкой.
 */

export const DOCUMENT_WAITING = [
  { value: "", label: "Все" },
  { value: "us", label: "Ждут нашей подписи" },
  { value: "them", label: "Ждём другую сторону" },
] as const;

export const DOCUMENT_SORTS = [
  { value: "statusAsc", label: "По стадии" },
  { value: "updatedDesc", label: "Недавно изменённые" },
  { value: "dueAsc", label: "Ближайший срок" },
  { value: "title", label: "По названию" },
] as const;

export type DocumentWaiting = (typeof DOCUMENT_WAITING)[number]["value"];
export type DocumentSort = (typeof DOCUMENT_SORTS)[number]["value"];

export type DocumentFilter = {
  kind: string;
  status: string;
  counterpartyId: string;
  waiting: DocumentWaiting;
  query: string;
  sort: DocumentSort;
};

export const DEFAULT_DOCUMENT_FILTER: DocumentFilter = {
  kind: "",
  status: "",
  counterpartyId: "",
  waiting: "",
  query: "",
  sort: "statusAsc",
};

type SearchParams = Record<string, string | string[] | undefined>;

export function readDocumentFilter(params: SearchParams): DocumentFilter {
  const kind = single(params.kind) ?? "";
  const status = single(params.status) ?? "";
  const waiting = single(params.waiting) ?? "";
  const sort = single(params.sort);

  return {
    kind: DOCUMENT_KINDS.includes(kind as DocumentKind) ? kind : "",
    status: DOCUMENT_STATUSES.includes(status as DocumentStatus) ? status : "",
    counterpartyId: single(params.counterpartyId) ?? "",
    waiting: DOCUMENT_WAITING.some((item) => item.value === waiting)
      ? (waiting as DocumentWaiting)
      : "",
    query: single(params.q)?.trim() ?? "",
    sort: DOCUMENT_SORTS.some((item) => item.value === sort)
      ? (sort as DocumentSort)
      : DEFAULT_DOCUMENT_FILTER.sort,
  };
}

export function buildDocumentWhere(filter: DocumentFilter): Prisma.DocumentWhereInput {
  const where: Prisma.DocumentWhereInput = {};

  if (filter.kind) where.kind = filter.kind;
  if (filter.status) where.status = filter.status;
  if (filter.counterpartyId) where.counterpartyId = filter.counterpartyId;

  // Чьей подписи ждём. Наша сторона — организация с отметкой «наша» в
  // справочнике: соседний департамент в матрице подписания такая же внешняя
  // сторона, как контрагент, и записывать его в «нас» нельзя.
  if (filter.waiting === "us") {
    where.signatures = { some: { status: "PENDING", counterparty: { isInternal: true } } };
  }
  if (filter.waiting === "them") {
    where.signatures = {
      some: {
        status: "PENDING",
        OR: [{ counterpartyId: null }, { counterparty: { isInternal: false } }],
      },
    };
  }

  if (filter.query) {
    const terms = normalizeQuery(filter.query).split(" ").filter(Boolean).slice(0, 6);
    if (terms.length > 0) {
      where.AND = terms.map((term) => ({ searchIndex: { contains: term } }));
    }
  }

  return where;
}

export function buildDocumentOrderBy(
  sort: DocumentSort,
): Prisma.DocumentOrderByWithRelationInput[] {
  if (sort === "updatedDesc") return [{ updatedAt: "desc" }];
  if (sort === "dueAsc") return [{ dueDate: { sort: "asc", nulls: "last" } }, { title: "asc" }];
  if (sort === "title") return [{ title: "asc" }];
  return [{ status: "asc" }, { updatedAt: "desc" }];
}

/** Сколько условий задано сверх выборки по умолчанию: число на кнопке «Фильтры». */
export function countActiveDocumentFilters(filter: DocumentFilter): number {
  const keys = Object.keys(DEFAULT_DOCUMENT_FILTER) as (keyof DocumentFilter)[];
  return keys.filter((key) => filter[key] !== DEFAULT_DOCUMENT_FILTER[key]).length;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
