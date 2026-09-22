import { describe, expect, it } from "vitest";
import { normalizeLetterByDirection } from "@/lib/letters";
import { letterInputSchema, type LetterInput } from "@/lib/validation";

const base: LetterInput = {
  projectId: "p1",
  number: "01-01-123/26",
  direction: "INCOMING",
  date: new Date("2026-09-01"),
  subject: "О согласовании",
  url: null,
  counterpartyId: null,
  ownerId: null,
  dueDate: new Date("2026-09-15"),
  status: "IN_PROGRESS",
  statusNote: null,
  responseRef: null,
  resolution: "Шаганову — подготовить ответ",
  signatory: "Иванов И. И.",
  responseToId: "letter-9",
  externalTaskKey: null,
  comment: null,
};

describe("normalizeLetterByDirection", () => {
  it("у входящего оставляет резолюцию и убирает поля исходящего", () => {
    const result = normalizeLetterByDirection(base, { answerNotRequired: false });
    expect(result.resolution).toBe("Шаганову — подготовить ответ");
    expect(result.signatory).toBeNull();
    expect(result.responseToId).toBeNull();
  });

  it("у исходящего оставляет подписанта и письмо-основание", () => {
    const result = normalizeLetterByDirection(
      { ...base, direction: "OUTGOING" },
      { answerNotRequired: false },
    );
    expect(result.resolution).toBeNull();
    expect(result.signatory).toBe("Иванов И. И.");
    expect(result.responseToId).toBe("letter-9");
  });

  it("«ответ не требуется» снимает срок и принимает письмо к сведению", () => {
    const result = normalizeLetterByDirection(base, { answerNotRequired: true });
    expect(result.dueDate).toBeNull();
    expect(result.status).toBe("NOTED");
  });

  it("не трогает статус, если по письму уже идёт своя работа", () => {
    const result = normalizeLetterByDirection(
      { ...base, status: "ON_APPROVAL" },
      { answerNotRequired: true },
    );
    expect(result.status).toBe("ON_APPROVAL");
    expect(result.dueDate).toBeNull();
  });

  it("не даёт письму стать ответом самому на себя", () => {
    const result = normalizeLetterByDirection(
      { ...base, direction: "OUTGOING", responseToId: "letter-9" },
      { answerNotRequired: false, selfId: "letter-9" },
    );
    expect(result.responseToId).toBeNull();
  });
});

describe("letterInputSchema", () => {
  /** Форма показывает поля по направлению, поэтому часть ключей не приходит вовсе. */
  it("принимает форму без полей другого направления", () => {
    const parsed = letterInputSchema.safeParse({
      projectId: "p1",
      number: "01-01-123/26",
      direction: "OUTGOING",
      date: "2026-09-01",
      subject: "О согласовании",
      url: "",
      counterpartyId: "",
      ownerId: "",
      dueDate: "",
      status: "IN_PROGRESS",
      statusNote: "",
      responseRef: "",
      signatory: "Шаганов А. В.",
      responseToId: "",
      externalTaskKey: "",
      comment: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.resolution).toBeNull();
    expect(parsed.success && parsed.data.signatory).toBe("Шаганов А. В.");
  });

  /** «Ответ не требуется» выключает поле срока, и браузер его не отправляет. */
  it("принимает форму без выключенного поля срока", () => {
    const parsed = letterInputSchema.safeParse({
      projectId: "p1",
      number: "01-01-124/26",
      direction: "INCOMING",
      date: "2026-09-01",
      subject: "К сведению",
      url: "",
      counterpartyId: "",
      ownerId: "",
      status: "IN_PROGRESS",
      statusNote: "",
      responseRef: "",
      resolution: "",
      externalTaskKey: "",
      comment: "",
      answerNotRequired: "on",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.dueDate).toBeNull();
  });
});
