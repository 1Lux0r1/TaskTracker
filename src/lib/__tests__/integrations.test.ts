import { describe, expect, it } from "vitest";
import { INTEGRATION_STAGES, integrationProgress, integrationStageLabel, milestoneState } from "@/lib/domain";

const today = new Date(2026, 8, 23);
const day = (n: number) => new Date(2026, 8, n);

describe("milestoneState", () => {
  it("факт важнее плана: этап пройден, даже если срок был просрочен", () => {
    expect(milestoneState({ plannedDate: day(1), actualDate: day(20) }, today)).toBe("done");
  });

  it("срок в прошлом — просрочка, на этой неделе — «скоро»", () => {
    expect(milestoneState({ plannedDate: day(22), actualDate: null }, today)).toBe("overdue");
    expect(milestoneState({ plannedDate: day(23), actualDate: null }, today)).toBe("soon");
    expect(milestoneState({ plannedDate: day(30), actualDate: null }, today)).toBe("soon");
    expect(milestoneState({ plannedDate: new Date(2026, 9, 5), actualDate: null }, today)).toBe(
      "planned",
    );
  });

  it("без вехи и без дат клетка пустая", () => {
    expect(milestoneState(undefined, today)).toBe("empty");
    expect(milestoneState({ plannedDate: null, actualDate: null }, today)).toBe("empty");
  });
});

describe("integrationProgress", () => {
  const stage = (index: number, actual: Date | null) => ({
    stage: INTEGRATION_STAGES[index].value,
    actualDate: actual,
  });

  it("считает пройденные этапы подряд с начала", () => {
    expect(integrationProgress([stage(0, day(1)), stage(1, day(2))])).toBe(2);
    expect(integrationProgress([])).toBe(0);
  });

  it("пропуск этапа останавливает счёт: перепрыгнуть регламент нельзя", () => {
    expect(integrationProgress([stage(0, day(1)), stage(2, day(5)), stage(3, day(6))])).toBe(1);
  });

  it("все пять этапов — организация подключена", () => {
    expect(integrationProgress(INTEGRATION_STAGES.map((_, index) => stage(index, day(1))))).toBe(5);
  });
});

describe("integrationStageLabel", () => {
  it("называет этап по-русски, а незнакомый возвращает как есть", () => {
    expect(integrationStageLabel("TEST_OPENED")).toBe("Открытие в тестовой среде");
    expect(integrationStageLabel("WAT")).toBe("WAT");
  });
});
