import type { Prisma } from "@/generated/prisma/client";
import {
  CLOSED_TASK_STATUSES,
  TASK_STATUSES,
  type TaskStatus,
} from "@/lib/domain";
import { normalizeQuery } from "@/lib/search";

/**
 * Разбор фильтров реестра задач. Правила те же, что у переписки: поиск на
 * виду, остальные условия под одной кнопкой, а отбор проверяется тестами.
 */

export const TASK_PRESETS = [
  { value: "open", label: "Открытые" },
  { value: "overdue", label: "Просроченные" },
  { value: "due7", label: "Срок в ближайшую неделю" },
  { value: "unassigned", label: "Без ответственного" },
  { value: "noDue", label: "Без срока" },
  { value: "all", label: "Все" },
] as const;

export const TASK_SORTS = [
  { value: "dueAsc", label: "Ближайший срок" },
  { value: "createdDesc", label: "Сначала новые" },
  { value: "project", label: "По проекту" },
] as const;

export type TaskPreset = (typeof TASK_PRESETS)[number]["value"];
export type TaskSort = (typeof TASK_SORTS)[number]["value"];

export type TaskFilter = {
  preset: TaskPreset;
  projectId: string;
  assigneeId: string;
  status: string;
  /** Треки свои у каждого проекта, поэтому в сквозном списке фильтруем по названию. */
  track: string;
  query: string;
  sort: TaskSort;
};

export const DEFAULT_TASK_FILTER: TaskFilter = {
  preset: "open",
  projectId: "",
  assigneeId: "",
  status: "",
  track: "",
  query: "",
  sort: "dueAsc",
};

type SearchParams = Record<string, string | string[] | undefined>;

export function readTaskFilter(params: SearchParams): TaskFilter {
  const preset = single(params.preset);
  const sort = single(params.sort);
  const status = single(params.status) ?? "";

  return {
    preset: TASK_PRESETS.some((item) => item.value === preset)
      ? (preset as TaskPreset)
      : DEFAULT_TASK_FILTER.preset,
    projectId: single(params.projectId) ?? "",
    assigneeId: single(params.assigneeId) ?? "",
    status: TASK_STATUSES.includes(status as TaskStatus) ? status : "",
    track: single(params.track) ?? "",
    query: single(params.q)?.trim() ?? "",
    sort: TASK_SORTS.some((item) => item.value === sort)
      ? (sort as TaskSort)
      : DEFAULT_TASK_FILTER.sort,
  };
}

export function buildTaskWhere(filter: TaskFilter, today: Date): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};
  const open = { notIn: CLOSED_TASK_STATUSES };

  if (filter.preset === "open") where.status = open;
  if (filter.preset === "overdue") {
    where.status = open;
    where.dueDate = { lt: today };
  }
  if (filter.preset === "due7") {
    where.status = open;
    where.dueDate = { gte: today, lte: new Date(today.getTime() + 7 * 86_400_000) };
  }
  if (filter.preset === "unassigned") {
    where.status = open;
    where.assigneeId = null;
  }
  if (filter.preset === "noDue") {
    where.status = open;
    where.dueDate = null;
  }

  // Поля под кнопкой уточняют выборку, поэтому заданные руками перебивают пресет.
  if (filter.projectId) where.projectId = filter.projectId;
  if (filter.assigneeId) where.assigneeId = filter.assigneeId;
  if (filter.status) where.status = filter.status;
  if (filter.track) where.track = { name: filter.track };

  if (filter.query) {
    // Каждое слово должно встретиться: так «выгрузка проводки» сужает выборку.
    const terms = normalizeQuery(filter.query).split(" ").filter(Boolean).slice(0, 6);
    if (terms.length > 0) {
      where.AND = terms.map((term) => ({
        OR: [
          { searchIndex: { contains: term } },
          // Номер задачи в индекс не входит: по «#12» ищут точное попадание.
          ...numberCondition(term),
        ],
      }));
    }
  }

  return where;
}

/**
 * Порядка «по приоритету» здесь нет: приоритет хранится строкой, и база
 * отсортировала бы его по алфавиту, поставив «низкий» выше «среднего».
 */
export function buildTaskOrderBy(sort: TaskSort): Prisma.TaskOrderByWithRelationInput[] {
  if (sort === "createdDesc") return [{ createdAt: "desc" }];
  if (sort === "project") return [{ project: { code: "asc" } }, { number: "asc" }];
  // Задачи без срока не должны занимать начало списка «ближайший срок».
  return [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
}

/** Сколько условий задано сверх выборки по умолчанию: число на кнопке «Фильтры». */
export function countActiveTaskFilters(filter: TaskFilter): number {
  const keys = Object.keys(DEFAULT_TASK_FILTER) as (keyof TaskFilter)[];
  return keys.filter((key) => filter[key] !== DEFAULT_TASK_FILTER[key]).length;
}

/** «#12» и «12» ищут задачу по номеру, а не по тексту. */
function numberCondition(term: string): Prisma.TaskWhereInput[] {
  const digits = term.replace(/^#/, "");
  if (!/^\d+$/.test(digits)) return [];
  return [{ number: Number(digits) }];
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
