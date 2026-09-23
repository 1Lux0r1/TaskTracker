import { describe, expect, it } from "vitest";
import {
  buildDocumentOrderBy,
  buildDocumentWhere,
  countActiveDocumentFilters,
  readDocumentFilter,
} from "@/lib/document-filters";
import { deriveDocumentStatus, documentStageRank } from "@/lib/domain";

describe("readDocumentFilter", () => {
  it("по умолчанию показывает все документы по стадии", () => {
    const filter = readDocumentFilter({});
    expect(filter.sort).toBe("statusAsc");
    expect(filter.kind).toBe("");
    expect(filter.waiting).toBe("");
  });

  it("отбрасывает вид и стадию, которых нет в справочнике", () => {
    const filter = readDocumentFilter({ kind: "ЧТО-ТО", status: "ЧТО-ТО", waiting: "кто-то" });
    expect(filter.kind).toBe("");
    expect(filter.status).toBe("");
    expect(filter.waiting).toBe("");
  });
});

describe("buildDocumentWhere", () => {
  it("«ждут нашей подписи» — незакрытая подпись нашей стороны", () => {
    const where = buildDocumentWhere(readDocumentFilter({ waiting: "us" }));
    expect(where.signatures).toEqual({
      some: { status: "PENDING", counterparty: { isInternal: true } },
    });
  });

  it("«ждём другую сторону» считает сторону без организации внешней", () => {
    const where = buildDocumentWhere(readDocumentFilter({ waiting: "them" }));
    expect(where.signatures).toEqual({
      some: {
        status: "PENDING",
        OR: [{ counterpartyId: null }, { counterparty: { isInternal: false } }],
      },
    });
  });

  it("каждое слово запроса должно встретиться", () => {
    const where = buildDocumentWhere(readDocumentFilter({ q: "Регламент Россети" }));
    expect(where.AND).toEqual([
      { searchIndex: { contains: "регламент" } },
      { searchIndex: { contains: "россети" } },
    ]);
  });
});

describe("buildDocumentOrderBy", () => {
  it("в порядке «ближайший срок» документы без срока уходят в конец", () => {
    expect(buildDocumentOrderBy("dueAsc")[0]).toEqual({ dueDate: { sort: "asc", nulls: "last" } });
  });
});

describe("countActiveDocumentFilters", () => {
  it("считает только заданные условия", () => {
    expect(countActiveDocumentFilters(readDocumentFilter({}))).toBe(0);
    expect(countActiveDocumentFilters(readDocumentFilter({ q: "акт", waiting: "us" }))).toBe(2);
  });
});

describe("стадии юридического трека", () => {
  it("«возвращён» и «передан в дело» матрица подписания не перебивает", () => {
    expect(deriveDocumentStatus([{ status: "SIGNED" }, { status: "PENDING" }], "RETURNED")).toBe(
      "RETURNED",
    );
    expect(deriveDocumentStatus([{ status: "SIGNED" }], "FILED")).toBe("FILED");
  });

  it("на обычной стадии итог по-прежнему считается по сторонам", () => {
    expect(deriveDocumentStatus([{ status: "SIGNED" }, { status: "PENDING" }], "DRAFT")).toBe(
      "SIGNING",
    );
  });

  it("порядок стадий ведёт от требующих действий к законченным", () => {
    const ranks = ["DECLINED", "RETURNED", "DRAFT", "REVIEW", "SENT", "SIGNING", "SIGNED", "FILED"]
      .map(documentStageRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(documentStageRank("DECLINED")).toBeLessThan(documentStageRank("FILED"));
  });

  it("незнакомая стадия уходит в конец, а не в начало", () => {
    expect(documentStageRank("НЕИЗВЕСТНО")).toBeGreaterThan(documentStageRank("FILED"));
  });
});
