import { describe, expect, it } from "vitest";
import { CLOSED_LETTER_STATUSES } from "@/lib/domain";
import {
  DEFAULT_LETTER_FILTER,
  buildLetterOrderBy,
  buildLetterWhere,
  countActiveFilters,
  readLetterFilter,
} from "@/lib/letter-filters";

const TODAY = new Date(2026, 8, 22);

describe("readLetterFilter", () => {
  it("без параметров показывает письма в работе", () => {
    expect(readLetterFilter({})).toEqual(DEFAULT_LETTER_FILTER);
  });

  it("отбрасывает неизвестные значения выборки, статуса и порядка", () => {
    const filter = readLetterFilter({
      preset: "что-то своё",
      status: "DRAFT",
      direction: "SIDEWAYS",
      sort: "случайно",
    });
    expect(filter.preset).toBe("open");
    expect(filter.status).toBe("");
    expect(filter.direction).toBe("");
    expect(filter.sort).toBe("dateDesc");
  });

  it("берёт первое значение повторяющегося параметра и чистит поиск", () => {
    const filter = readLetterFilter({ counterpartyId: ["a", "b"], q: "  регламент  " });
    expect(filter.counterpartyId).toBe("a");
    expect(filter.query).toBe("регламент");
  });

  it("принимает только даты в формате поля", () => {
    expect(readLetterFilter({ from: "2026-09-01", to: "01.09.2026" })).toMatchObject({
      from: "2026-09-01",
      to: "",
    });
  });
});

describe("buildLetterWhere", () => {
  it("просроченные — только незакрытые со сроком в прошлом", () => {
    const where = buildLetterWhere({ ...DEFAULT_LETTER_FILTER, preset: "overdue" }, TODAY);
    expect(where.status).toEqual({ notIn: CLOSED_LETTER_STATUSES });
    expect(where.dueDate).toEqual({ lt: TODAY });
  });

  it("«ждут нашего ответа» — незакрытые входящие", () => {
    const where = buildLetterWhere({ ...DEFAULT_LETTER_FILTER, preset: "waitingUs" }, TODAY);
    expect(where.direction).toBe("INCOMING");
    expect(where.status).toEqual({ notIn: CLOSED_LETTER_STATUSES });
  });

  it("выбранные руками направление и статус перебивают выборку", () => {
    const where = buildLetterWhere(
      { ...DEFAULT_LETTER_FILTER, preset: "waitingUs", direction: "OUTGOING", status: "CLOSED" },
      TODAY,
    );
    expect(where.direction).toBe("OUTGOING");
    expect(where.status).toBe("CLOSED");
  });

  it("период по дате письма захватывает последний день целиком", () => {
    const where = buildLetterWhere(
      { ...DEFAULT_LETTER_FILTER, from: "2026-09-01", to: "2026-09-22" },
      TODAY,
    );
    expect(where.date).toEqual({
      gte: new Date("2026-09-01T00:00:00"),
      lte: new Date("2026-09-22T23:59:59.999"),
    });
  });

  it("каждое слово поиска должно встретиться", () => {
    const where = buildLetterWhere(
      { ...DEFAULT_LETTER_FILTER, query: "Россети  Регламент" },
      TODAY,
    );
    expect(where.AND).toEqual([
      { OR: [{ searchIndex: { contains: "россети" } }, { number: { contains: "россети" } }] },
      { OR: [{ searchIndex: { contains: "регламент" } }, { number: { contains: "регламент" } }] },
    ]);
  });

  it("ё в запросе ищется как е — так же, как в индексе", () => {
    const where = buildLetterWhere({ ...DEFAULT_LETTER_FILTER, query: "учёт" }, TODAY);
    expect(where.AND).toEqual([
      { OR: [{ searchIndex: { contains: "учет" } }, { number: { contains: "учет" } }] },
    ]);
  });

  it("выборка «все» без полей не ограничивает ничего", () => {
    expect(buildLetterWhere({ ...DEFAULT_LETTER_FILTER, preset: "all" }, TODAY)).toEqual({});
  });
});

describe("buildLetterOrderBy", () => {
  it("по ближайшему сроку письма без срока уходят в конец", () => {
    expect(buildLetterOrderBy("dueAsc")[0]).toEqual({ dueDate: { sort: "asc", nulls: "last" } });
  });
});

describe("countActiveFilters", () => {
  it("считает только отличия от выборки по умолчанию", () => {
    expect(countActiveFilters(DEFAULT_LETTER_FILTER)).toBe(0);
    expect(
      countActiveFilters({ ...DEFAULT_LETTER_FILTER, preset: "all", ownerId: "m1", sort: "dueAsc" }),
    ).toBe(3);
  });
});
