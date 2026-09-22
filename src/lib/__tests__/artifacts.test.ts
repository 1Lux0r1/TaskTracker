import { describe, expect, it } from "vitest";
import { readArtifacts } from "@/lib/validation";
import { artifactKindLabel, isLinkArtifact } from "@/lib/domain";

function form(rows: [string, string, string][]): FormData {
  const data = new FormData();
  for (const [kind, label, value] of rows) {
    data.append("artifactKind", kind);
    data.append("artifactLabel", label);
    data.append("artifactValue", value);
  }
  return data;
}

describe("артефакты задачи", () => {
  it("собирает строки формы по порядку", () => {
    const artifacts = readArtifacts(
      form([
        ["EDO_LINK", "Письмо", "https://mosedo.mos.ru/1"],
        ["CUSTOM_VALUE", "", "Согласовано устно"],
      ]),
    );
    expect(artifacts).toEqual([
      { kind: "EDO_LINK", label: "Письмо", value: "https://mosedo.mos.ru/1", sortOrder: 0 },
      { kind: "CUSTOM_VALUE", label: null, value: "Согласовано устно", sortOrder: 1 },
    ]);
  });

  it("отбрасывает пустые строки", () => {
    const artifacts = readArtifacts(
      form([
        ["EDO_LINK", "", "   "],
        ["JIRA_LINK", "", "AISRKII-1"],
      ]),
    );
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].value).toBe("AISRKII-1");
  });

  it("неизвестный вид считает своим значением", () => {
    const artifacts = readArtifacts(form([["ЧТО-ТО", "", "значение"]]));
    expect(artifacts[0].kind).toBe("CUSTOM_VALUE");
  });

  it("ссылкой считает только ссылочные виды", () => {
    expect(isLinkArtifact("EDO_LINK")).toBe(true);
    expect(isLinkArtifact("JIRA_LINK")).toBe(true);
    expect(isLinkArtifact("SYSTEM_DOC")).toBe(false);
    expect(isLinkArtifact("CUSTOM_VALUE")).toBe(false);
  });

  it("подписывает вид по-русски", () => {
    expect(artifactKindLabel("EDO_LINK")).toBe("Ссылка на ЭДО");
    expect(artifactKindLabel("НЕТ_ТАКОГО")).toBe("НЕТ_ТАКОГО");
  });
});
