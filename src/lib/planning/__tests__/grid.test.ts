import { describe, expect, it } from "vitest";
import { moduleTaskCounts, sharedModules, subsystemDkCounts, subsystemTaskCounts } from "../grid";

const dks = [
  { id: "dk1", blockKey: "Gaz.Rte", subsystemId: "TA" },
  { id: "dk2", blockKey: "Gaz.Rte", subsystemId: null },
  { id: "dk3", blockKey: "Gaz.Res", subsystemId: "TA" },
];

const tasks = [
  { dkId: "dk1", blockKey: "Gaz.Rte", moduleId: "ms08", moduleSubsystemId: "TA" },
  { dkId: "dk1", blockKey: "Gaz.Rte", moduleId: "ms08", moduleSubsystemId: "TA" },
  { dkId: "dk1", blockKey: "Gaz.Rte", moduleId: null, moduleSubsystemId: null },
  { dkId: "dk2", blockKey: "Gaz.Rte", moduleId: null, moduleSubsystemId: null },
  { dkId: "dk3", blockKey: "Gaz.Res", moduleId: "ms08", moduleSubsystemId: "TA" },
  { dkId: "dk3", blockKey: "Gaz.Res", moduleId: "ms12", moduleSubsystemId: "UI" },
];

describe("решётка", () => {
  it("МС × блоки считает задачи и находит МС в двух блоках", () => {
    const counts = moduleTaskCounts(tasks);
    expect(counts.get("ms08")?.get("Gaz.Rte")).toBe(2);
    expect(counts.get("ms08")?.get("Gaz.Res")).toBe(1);
    expect([...sharedModules(counts)]).toEqual(["ms08"]);
  });

  it("подсистемы × блоки по задачам берут подсистему МС, а без МС — подсистему ДК", () => {
    const counts = subsystemTaskCounts(dks, tasks);
    expect(counts.get("TA")?.get("Gaz.Rte")).toBe(3);
    expect(counts.get("TA")?.get("Gaz.Res")).toBe(1);
    expect(counts.get("UI")?.get("Gaz.Res")).toBe(1);
  });

  it("подсистемы × блоки по ДК считают каждый ДК один раз", () => {
    const counts = subsystemDkCounts(dks, tasks);
    expect(counts.get("TA")?.get("Gaz.Rte")).toBe(1);
    expect(counts.get("TA")?.get("Gaz.Res")).toBe(1);
    expect(counts.get("UI")?.get("Gaz.Res")).toBe(1);
  });
});
