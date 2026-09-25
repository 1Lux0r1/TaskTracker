import type { Prisma } from "@/generated/prisma/client";
import { MEETING_KINDS, type MeetingKind } from "@/lib/domain";
import { normalizeQuery } from "@/lib/search";

/**
 * Отбор встреч. По умолчанию — все: экран, как в макете, делит их на две
 * карточки, ближайшие и прошедшие с материалами и решениями.
 */
export const MEETING_PRESETS = [
  { value: "all", label: "Все" },
  { value: "upcoming", label: "Предстоящие" },
  { value: "past", label: "Прошедшие" },
  { value: "noDecisions", label: "Без решений" },
] as const;

export type MeetingPreset = (typeof MEETING_PRESETS)[number]["value"];

export type MeetingFilter = {
  preset: MeetingPreset;
  projectId: string;
  kind: string;
  query: string;
};

export const DEFAULT_MEETING_FILTER: MeetingFilter = {
  preset: "all",
  projectId: "",
  kind: "",
  query: "",
};

type SearchParams = Record<string, string | string[] | undefined>;

export function readMeetingFilter(params: SearchParams): MeetingFilter {
  const preset = single(params.preset);
  const kind = single(params.kind) ?? "";

  return {
    preset: MEETING_PRESETS.some((item) => item.value === preset)
      ? (preset as MeetingPreset)
      : DEFAULT_MEETING_FILTER.preset,
    projectId: single(params.projectId) ?? "",
    kind: MEETING_KINDS.includes(kind as MeetingKind) ? kind : "",
    query: single(params.q)?.trim() ?? "",
  };
}

export function buildMeetingWhere(filter: MeetingFilter, today: Date): Prisma.MeetingWhereInput {
  const where: Prisma.MeetingWhereInput = {};

  if (filter.preset === "upcoming") where.date = { gte: today };
  if (filter.preset === "past") where.date = { lt: today };
  // Встреча без записанных решений — незакрытый хвост: протокол не оформлен.
  if (filter.preset === "noDecisions") {
    where.date = { lte: today };
    where.OR = [{ decisions: null }, { decisions: "" }];
  }

  if (filter.projectId) where.projectId = filter.projectId;
  if (filter.kind) where.kind = filter.kind;

  if (filter.query) {
    const terms = normalizeQuery(filter.query).split(" ").filter(Boolean).slice(0, 6);
    if (terms.length > 0) {
      where.AND = terms.map((term) => ({ searchIndex: { contains: term } }));
    }
  }

  return where;
}

/** Предстоящие показываем от ближайшей, прошедшие — от последней. */
export function buildMeetingOrderBy(
  preset: MeetingPreset,
): Prisma.MeetingOrderByWithRelationInput[] {
  if (preset === "upcoming") return [{ date: "asc" }, { startTime: "asc" }];
  return [{ date: "desc" }, { startTime: "desc" }];
}

export function countActiveMeetingFilters(filter: MeetingFilter): number {
  const keys = Object.keys(DEFAULT_MEETING_FILTER) as (keyof MeetingFilter)[];
  return keys.filter((key) => filter[key] !== DEFAULT_MEETING_FILTER[key]).length;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
