import { describe, expect, it } from "vitest";
import {
  buildTaskOrderBy,
  buildTaskWhere,
  countActiveTaskFilters,
  readTaskFilter,
} from "@/lib/task-filters";

const TODAY = new Date("2026-09-22T00:00:00");

describe("readTaskFilter", () => {
  it("без параметров берёт открытые задачи по ближайшему сроку", () => {
    const filter = readTaskFilter({});
    expect(filter.preset).toBe("open");
    expect(filter.sort).toBe("dueAsc");
    expect(filter.query).toBe("");
  });

  it("отбрасывает выборку и статус, которых нет", () => {
    const filter = readTaskFilter({ preset: "выдумка", status: "НЕТ ТАКОГО", sort: "как-нибудь" });
    expect(filter.preset).toBe("open");
    expect(filter.status).toBe("");
    expect(filter.sort).toBe("dueAsc");
  });

  it("берёт первое значение, если параметр повторили", () => {
    const filter = readTaskFilter({ q: ["  выгрузка  ", "лишнее"] });
    expect(filter.query).toBe("выгрузка");
  });
});

describe("buildTaskWhere", () => {
  it("просроченные — только незакрытые со сроком раньше сегодня", () => {
    const where = buildTaskWhere(readTaskFilter({ preset: "overdue" }), TODAY);
    expect(where.dueDate).toEqual({ lt: TODAY });
    expect(where.status).toEqual({ notIn: ["DONE", "CANCELLED"] });
  });

  it("статус, заданный руками, перебивает выборку", () => {
    const where = buildTaskWhere(readTaskFilter({ preset: "open", status: "DONE" }), TODAY);
    expect(where.status).toBe("DONE");
  });

  it("каждое слово запроса должно встретиться", () => {
    const where = buildTaskWhere(readTaskFilter({ q: "Выгрузка Проводок" }), TODAY);
    expect(where.AND).toHaveLength(2);
    expect(where.AND).toEqual([
      { OR: [{ searchIndex: { contains: "выгрузка" } }] },
      { OR: [{ searchIndex: { contains: "проводок" } }] },
    ]);
  });

  it("по «#12» ищет задачу с таким номером", () => {
    const where = buildTaskWhere(readTaskFilter({ q: "#12" }), TODAY);
    expect(where.AND).toEqual([
      { OR: [{ searchIndex: { contains: "#12" } }, { number: 12 }] },
    ]);
  });

  it("трек отбирается по названию: в каждом проекте он свой", () => {
    const where = buildTaskWhere(readTaskFilter({ track: "Юридический" }), TODAY);
    expect(where.track).toEqual({ name: "Юридический" });
  });
});

describe("buildTaskOrderBy", () => {
  it("в порядке «ближайший срок» задачи без срока уходят в конец", () => {
    expect(buildTaskOrderBy("dueAsc")[0]).toEqual({ dueDate: { sort: "asc", nulls: "last" } });
  });
});

describe("countActiveTaskFilters", () => {
  it("считает только то, что отличается от выборки по умолчанию", () => {
    expect(countActiveTaskFilters(readTaskFilter({}))).toBe(0);
    expect(countActiveTaskFilters(readTaskFilter({ q: "тест", status: "DONE" }))).toBe(2);
  });
});
