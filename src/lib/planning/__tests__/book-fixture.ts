import type { BookCell, BookSheet } from "../book";

/** Лист из строк: строка — массив значений, ячейка-объект — с формулой или заливкой. */
function sheet(name: string, rows: (BookCell | string | number | Date | null)[][]): BookSheet {
  return {
    name,
    rows: rows.map((row) =>
      row.map((cell) => (cell !== null && typeof cell === "object" && !(cell instanceof Date) ? cell : { value: cell })),
    ),
  };
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const green = { value: null, fill: "FF92D050" };

export const BOOK: BookSheet[] = [
  sheet("Справочник", [
    ["2. Подсистемы"],
    ["Система", "Название", "Код подсистемы"],
    ["RKII", "Подсистема анализа территорий", "TA"],
    ["RKII", "Подсистема отчетности", "REP"],
    [],
    ["Код этапа", "Название", "Порядок", "Уровень шифра"],
    ["ОА", "Отраслевой анализ", 1, "Бизнес"],
    ["Арх", "Архитектура", 2, "Бизнес/МС"],
    ["Р", "Разработка", 3, "МС"],
    [],
    ["№ МС", "Название", "Ключ МС (реестр)", "Подсистема", "Код подсистемы", "Система", "Версия МС", "Проверка №", "служебное", "№ МС в подсистеме"],
    [8, "terra-analyser-bff", { value: null, formula: "F12&E12" }, "Подсистема анализа территорий", null, "RKII", "1.0.0", null, null, 3],
    [50, "Микросервис.Трассировка", null, "Подсистема анализа территорий", null, "RKII", null, null, null, 1],
    [],
    ["Код", "Название", "Область (код)", null, null, "Приоритет ОФТ"],
    ["TA", "Территориальный анализ", "—", null, null, "Высокий"],
    ["TATep", "Теплоснабжение", "TA", null, null, "Средний"],
    ["Base", "Ядерный функционал", "—", null, null, "Низкий"],
  ]),
  sheet("ОФТ", [
    [],
    [null, "Код", "Наименование", "Приоритет", "Статус"],
    [null, "RKII", "АИС РКИИЭ"],
    [null, "RKII.TA", "Территориальный анализ"],
    [null, "RKII.TATep", "Теплоснабжение"],
    [null, "RKII.TATep.1", "Трассировка", "Высокий", "В работе"],
  ]),
  sheet("Дорожная карта", [
    [],
    [null, "Код", "Наименование", "Отв.", "Статус", "Срок"],
    [null, "RKII.TATep.1", "Трассировка"],
    [null, "RKII.TATep.1.1", "ДИТ видит связность", null, "Выполнено", utc(2026, 6, 30)],
    [null, "RKII.TATep.1.2", "Path-finder", "ОА", "В очереди", utc(2026, 10, 31)],
    [null, "RKII.Base.1.1", "Раздел не заведён", null, "В работе"],
  ]),
  sheet("План работ", [
    [],
    [null, "Код Бизнес", "Код МС", "Код Задачи", "Наименование", "Статус", "Срок", 2026, null, null],
    [null, null, null, null, null, null, null, "Сен", "Окт", "Ноя"],
    [null, null, "TA", { value: null, formula: "=C4" }],
    [null, { value: null, formula: "'Дорожная карта'!B4" }, "TA.1"],
    [null, { value: null, formula: "$B5" }, "TA.1.Р", null, "Разработка трассировки", "Выполнено", utc(2026, 10, 31), green, green, null],
    [null, { value: null, formula: "$B6" }, "TA.1.Р2", null, "Доработка", "В очереди", utc(2026, 11, 30)],
    [null, { value: null, formula: "$B7" }, "TA.1.Ого", null, "Неизвестный этап"],
    [null, { value: null, formula: "$B8" }, "TA.1(2).", null, "Неправильный код"],
    [null, { value: null, formula: "'Дорожная карта'!B6" }, "TA.3"],
    [null, { value: null, formula: "$B10" }, "TA.3.Арх", null, "Архитектура bff", null, null, null, null, green],
  ]),
];

