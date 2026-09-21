import { describe, expect, it } from "vitest";
import {
  completionDate,
  inferStatusFromChronicle,
  parseChronicle,
} from "@/lib/excel/chronicle";

describe("parseChronicle", () => {
  it("разбирает журнал с датой в начале строки", () => {
    const entries = parseChronicle(
      "05.05.2026 драфт письма загружен в ЭДО\n06.05.2026 на согласовании у Ежовой",
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].body).toBe("драфт письма загружен в ЭДО");
    expect(entries[0].occurredOn?.getDate()).toBe(5);
    expect(entries[1].body).toBe("на согласовании у Ежовой");
    expect(entries[1].occurredOn?.getMonth()).toBe(4);
  });

  it("разбирает дату в конце строки", () => {
    const [entry] = parseChronicle("Справка передана на ревью 07.06.2026");
    expect(entry.body).toBe("Справка передана на ревью");
    expect(entry.occurredOn?.getDate()).toBe(7);
  });

  it("оставляет строку без даты как есть", () => {
    const [entry] = parseChronicle("Пальчикова прислала драфт, надо проверить");
    expect(entry.occurredOn).toBeNull();
    expect(entry.body).toBe("Пальчикова прислала драфт, надо проверить");
  });

  it("игнорирует пустые строки", () => {
    expect(parseChronicle("\n\n   \n")).toHaveLength(0);
  });
});

describe("inferStatusFromChronicle", () => {
  it("узнаёт справочный статус без журнала", () => {
    expect(inferStatusFromChronicle("Выполнено", parseChronicle("Выполнено"))).toBe("DONE");
  });

  it("закрывает задачу по префиксу «Выполнено» с датой", () => {
    const raw = "Выполнено 20.05.2026";
    expect(inferStatusFromChronicle(raw, parseChronicle(raw))).toBe("DONE");
  });

  it("считает задачу в работе, если журнал непустой и не закрыт", () => {
    const raw = "05.05.2026 драфт письма загружен в ЭДО\n06.05.2026 на согласовании";
    expect(inferStatusFromChronicle(raw, parseChronicle(raw))).toBe("IN_PROGRESS");
  });

  it("пустой статус означает «к выполнению»", () => {
    expect(inferStatusFromChronicle("", [])).toBe("TODO");
  });
});

describe("completionDate", () => {
  it("берёт дату записи о выполнении", () => {
    const raw = "01.05.2026 начали\nВыполнено 20.05.2026";
    const date = completionDate(parseChronicle(raw));
    expect(date?.getDate()).toBe(20);
  });

  it("возвращает null, если задача не закрывалась", () => {
    expect(completionDate(parseChronicle("01.05.2026 начали"))).toBeNull();
  });
});
