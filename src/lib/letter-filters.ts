import type { Prisma } from "@/generated/prisma/client";
import {
  CLOSED_LETTER_STATUSES,
  LETTER_DIRECTIONS,
  LETTER_STATUSES,
  type LetterDirection,
  type LetterStatus,
} from "@/lib/domain";
import { normalizeQuery } from "@/lib/search";

/**
 * Разбор фильтров реестра переписки вынесен из страницы: письма ищут руками
 * каждый день, и правила отбора надо проверять тестами, а не глазами.
 */

export const LETTER_PRESETS = [
  { value: "open", label: "В работе" },
  { value: "overdue", label: "Просроченные" },
  { value: "due7", label: "Срок в ближайшую неделю" },
  { value: "waitingUs", label: "Ждут нашего ответа" },
  { value: "waitingThem", label: "Ждём их ответа" },
  { value: "noOwner", label: "Без ответственного" },
  { value: "noDue", label: "Без срока" },
  { value: "all", label: "Все" },
] as const;

export const LETTER_SORTS = [
  { value: "dateDesc", label: "Сначала новые" },
  { value: "dateAsc", label: "Сначала старые" },
  { value: "dueAsc", label: "Ближайший срок" },
  { value: "counterparty", label: "По организации" },
] as const;

export type LetterPreset = (typeof LETTER_PRESETS)[number]["value"];
export type LetterSort = (typeof LETTER_SORTS)[number]["value"];

export type LetterFilter = {
  preset: LetterPreset;
  direction: string;
  status: string;
  counterpartyId: string;
  ownerId: string;
  /** Дата письма не раньше, в формате поля <input type="date">. */
  from: string;
  /** Дата письма не позже. */
  to: string;
  query: string;
  sort: LetterSort;
};

export const DEFAULT_LETTER_FILTER: LetterFilter = {
  preset: "open",
  direction: "",
  status: "",
  counterpartyId: "",
  ownerId: "",
  from: "",
  to: "",
  query: "",
  sort: "dateDesc",
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Значения из строки запроса: всё лишнее отбрасываем, чтобы ссылку можно было править руками. */
export function readLetterFilter(params: SearchParams): LetterFilter {
  const preset = single(params.preset);
  const sort = single(params.sort);
  const direction = single(params.direction) ?? "";
  const status = single(params.status) ?? "";

  return {
    preset: LETTER_PRESETS.some((item) => item.value === preset)
      ? (preset as LetterPreset)
      : DEFAULT_LETTER_FILTER.preset,
    direction: LETTER_DIRECTIONS.includes(direction as LetterDirection) ? direction : "",
    status: LETTER_STATUSES.includes(status as LetterStatus) ? status : "",
    counterpartyId: single(params.counterpartyId) ?? "",
    ownerId: single(params.ownerId) ?? "",
    from: isDateInput(single(params.from)) ? (single(params.from) as string) : "",
    to: isDateInput(single(params.to)) ? (single(params.to) as string) : "",
    query: single(params.q)?.trim() ?? "",
    sort: LETTER_SORTS.some((item) => item.value === sort)
      ? (sort as LetterSort)
      : DEFAULT_LETTER_FILTER.sort,
  };
}

/**
 * Условие выборки. `today` передаётся снаружи: страница берёт начало суток,
 * тест — фиксированную дату.
 */
export function buildLetterWhere(filter: LetterFilter, today: Date): Prisma.LetterWhereInput {
  const where: Prisma.LetterWhereInput = {};
  const open = { notIn: CLOSED_LETTER_STATUSES };

  if (filter.preset === "open") where.status = open;
  if (filter.preset === "overdue") {
    where.status = open;
    where.dueDate = { lt: today };
  }
  if (filter.preset === "due7") {
    where.status = open;
    where.dueDate = { gte: today, lte: new Date(today.getTime() + 7 * 86_400_000) };
  }
  // Главный вопрос на любом статусе: мяч на нашей стороне или на их.
  // Незакрытое входящее ждёт ответа от нас, незакрытое исходящее — от них.
  if (filter.preset === "waitingUs") {
    where.status = open;
    where.direction = "INCOMING";
  }
  if (filter.preset === "waitingThem") {
    where.status = open;
    where.direction = "OUTGOING";
  }
  if (filter.preset === "noOwner") {
    where.status = open;
    where.ownerId = null;
  }
  if (filter.preset === "noDue") {
    where.status = open;
    where.dueDate = null;
  }

  // Поля рядом с выборкой уточняют её, поэтому заданные руками перебивают пресет.
  if (filter.direction) where.direction = filter.direction;
  if (filter.status) where.status = filter.status;
  if (filter.counterpartyId) where.counterpartyId = filter.counterpartyId;
  if (filter.ownerId) where.ownerId = filter.ownerId;

  const period = datePeriod(filter.from, filter.to);
  if (period) where.date = period;

  if (filter.query) {
    // Каждое слово должно встретиться: так «россети регламент» сужает выборку,
    // а не выдаёт всё, где есть хотя бы одно из слов.
    const terms = normalizeQuery(filter.query).split(" ").filter(Boolean).slice(0, 6);
    if (terms.length > 0) {
      where.AND = terms.map((term) => ({
        OR: [{ searchIndex: { contains: term } }, { number: { contains: term } }],
      }));
    }
  }

  return where;
}

export function buildLetterOrderBy(sort: LetterSort): Prisma.LetterOrderByWithRelationInput[] {
  if (sort === "dateAsc") return [{ date: "asc" }, { createdAt: "asc" }];
  // Письма без срока не должны занимать начало списка «ближайший срок».
  if (sort === "dueAsc") return [{ dueDate: { sort: "asc", nulls: "last" } }, { date: "desc" }];
  if (sort === "counterparty") {
    return [{ counterparty: { name: "asc" } }, { date: "desc" }];
  }
  return [{ date: "desc" }, { createdAt: "desc" }];
}

/** Сколько полей задано сверх выборки по умолчанию — реестр показывает это на кнопке сброса. */
export function countActiveFilters(filter: LetterFilter): number {
  const keys = Object.keys(DEFAULT_LETTER_FILTER) as (keyof LetterFilter)[];
  return keys.filter((key) => filter[key] !== DEFAULT_LETTER_FILTER[key]).length;
}

function datePeriod(from: string, to: string): Prisma.DateTimeNullableFilter | null {
  if (!from && !to) return null;
  const period: Prisma.DateTimeNullableFilter = {};
  if (from) period.gte = new Date(`${from}T00:00:00`);
  // Конец дня, иначе письмо, заведённое датой «по», в выборку не попадёт.
  if (to) period.lte = new Date(`${to}T23:59:59.999`);
  return period;
}

function isDateInput(value: string | undefined): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
