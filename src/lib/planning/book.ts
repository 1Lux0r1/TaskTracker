/**
 * Разбор книги «Планирование развития системы» заказчика. Листы ищутся по
 * названию, таблицы на них — по подписям колонок, а не по адресам ячеек:
 * книга ещё правится, строки и колонки в ней будут сдвигаться.
 *
 * Что берётся:
 *   «Справочник»      — подсистемы, этапы, реестр МС, области и направления;
 *   «ОФТ»             — разделы направлений (в модели — части, блоки);
 *   «Дорожная карта»  — пункты разделов (в модели — ДК): статус и срок;
 *   «План работ»      — задачи по МС с этапом и повтором, сроки по шкале.
 *
 * Логика книги местами сломана (заказчик это знает и будет её править),
 * поэтому разбор не падает на первой ошибке: всё, что не сходится, уходит в
 * замечания, а годные строки загружаются.
 */

export type BookCell = { value: string | number | Date | null; formula?: string; fill?: string };
export type BookSheet = { name: string; rows: BookCell[][] };

export type StageLevel = "DK" | "DK_OR_MS" | "MS";

export type BookData = {
  systemName: string | null;
  subsystems: { system: string; code: string; name: string }[];
  stages: { code: string; name: string; level: StageLevel; sortOrder: number }[];
  modules: {
    system: string;
    number: number;
    name: string;
    subsystem: string;
    subsystemNumber: number | null;
    version: string | null;
  }[];
  directions: { code: string; name: string; area: string | null }[];
  /** Области ОФТ (TA): группа направлений, в шифр не входит. */
  areas: { code: string; name: string }[];
  parts: { direction: string; code: string; name: string }[];
  dks: {
    direction: string;
    part: string;
    number: number;
    name: string;
    status: string;
    deadline: Date | null;
    owner: string | null;
  }[];
  tasks: {
    /** Строка листа «План работ» — для замечаний. */
    row: number;
    direction: string;
    part: string;
    dk: number;
    subsystem: string;
    msNumber: number;
    stage: string;
    repeat: number;
    name: string;
    status: string | null;
    startDate: Date | null;
    finishDate: Date | null;
  }[];
  /** Что найдено и где: печатается при пробном прогоне. */
  found: string[];
  /** Что в книге не сходится: строка и причина. */
  problems: string[];
};

export function text(cell: BookCell | undefined): string {
  const value = cell?.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** Дата ячейки без времени. Excel хранит даты в полночь UTC. */
export function asDate(cell: BookCell | undefined): Date | null {
  const value = cell?.value;
  if (value instanceof Date) return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  const match = text(cell).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
}

/** «Бизнес» — задача по пункту, «МС» — по МС, «Бизнес/МС» — и так, и так. */
export function stageLevel(value: string): StageLevel {
  const v = value.toLowerCase();
  const business = v.includes("бизнес") || v.includes("дк");
  const ms = v.includes("мс") || v.includes("ms");
  if (business && ms) return "DK_OR_MS";
  return business ? "DK" : "MS";
}

/**
 * Статус пункта дорожной карты книги → статус ДК модуля. Наборы разные:
 * в книге нет предпроекта и согласования ТР, в модуле нет «в очереди».
 */
export function dkStatusOf(value: string): string {
  const v = value.toLowerCase();
  if (v.startsWith("выполн")) return "DONE";
  if (v.startsWith("замор") || v.includes("отмен")) return "FROZEN";
  if (v.startsWith("анализ")) return "ANALYSIS";
  if (v.startsWith("разраб") || v.startsWith("тестир") || v.startsWith("в работе")) return "PRODUCTION";
  return "PRESTUDY";
}

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Адрес ячейки «B85» → строка и колонка с нуля. */
function address(ref: string): { row: number; col: number } | null {
  const match = ref.replace(/\$/g, "").match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = [...match[1]].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
  return { row: Number(match[2]) - 1, col };
}

/**
 * Значение ячейки с разворотом простых ссылок: ='Дорожная карта'!B85, =$B6.
 * Книга сохранена без вычисленных значений, поэтому ссылку разворачиваем
 * сами. Сложные формулы не считаем — для них значение пустое.
 */
export function resolveCell(sheets: BookSheet[], sheet: BookSheet, cell: BookCell | undefined, depth = 0): string {
  if (!cell) return "";
  if (!cell.formula) return text(cell);
  if (depth > 50) return "";
  const match = cell.formula.trim().match(/^(?:'([^']+)'!|([^'!=\s]+)!)?(\$?[A-Z]+\$?\d+)$/);
  if (!match) return text(cell);
  const target = match[1] || match[2] ? sheets.find((item) => item.name === (match[1] ?? match[2])) : sheet;
  const at = address(match[3]);
  if (!target || !at) return "";
  return resolveCell(sheets, target, target.rows[at.row]?.[at.col], depth + 1);
}

type Header = { row: number; cols: Map<string, number> };

/**
 * Строка-шапка, где есть все обязательные подписи (сравнение без регистра,
 * по началу подписи). Необязательные подписи ищутся в той же строке.
 */
function findHeader(sheet: BookSheet, labels: string[], optional: string[] = []): Header | null {
  for (let r = 0; r < sheet.rows.length; r += 1) {
    const cols = new Map<string, number>();
    sheet.rows[r].forEach((cell, index) => {
      const value = text(cell).toLowerCase();
      for (const label of [...labels, ...optional]) {
        if (!cols.has(label) && value.startsWith(label)) cols.set(label, index);
      }
    });
    if (labels.every((label) => cols.has(label))) return { row: r, cols };
  }
  return null;
}

/** Строки таблицы под шапкой — до первой строки с пустой ключевой колонкой. */
function* tableRows(sheet: BookSheet, header: Header, key: string) {
  for (let r = header.row + 1; r < sheet.rows.length; r += 1) {
    const row = sheet.rows[r];
    if (!text(row[header.cols.get(key)!]) && !row[header.cols.get(key)!]?.formula) return;
    yield { r, get: (label: string) => row[header.cols.get(label) ?? -1] };
  }
}

const findSheet = (sheets: BookSheet[], pattern: RegExp) => sheets.find((sheet) => pattern.test(sheet.name));

/** Код раздела и пункта из книги: RKII.TATep.1.4 → направление, раздел, номер. */
const CODE = /^([A-Za-z0-9]+)\.([A-Za-z][A-Za-z0-9]*)(?:\.(\d+))?(?:\.(\d+))?$/;
/** Колонка «Код МС» плана: TA, TA.1, TA.1.Р2. */
const MS_CODE = /^([A-Za-z][A-Za-z0-9]*)(?:\.(\d+)(?:\.(\p{L}+)(\d*))?)?$/u;

export function parseBook(sheets: BookSheet[], systemCode = "RKII"): BookData {
  const data: BookData = {
    systemName: null,
    subsystems: [],
    stages: [],
    modules: [],
    directions: [],
    areas: [],
    parts: [],
    dks: [],
    tasks: [],
    found: [],
    problems: [],
  };

  const reference = findSheet(sheets, /справочник/i);
  if (reference) readReference(reference, data, systemCode);
  else data.problems.push("Лист «Справочник» не найден");

  const oft = findSheet(sheets, /^офт/i);
  const roadmap = findSheet(sheets, /дорожн/i);
  for (const sheet of [oft, roadmap]) if (sheet) readCodes(sheet, data, systemCode);
  if (!roadmap) data.problems.push("Лист «Дорожная карта» не найден");

  const plan = findSheet(sheets, /план\s+работ/i);
  if (plan) readPlan(sheets, plan, data, systemCode);
  else data.problems.push("Лист «План работ» не найден");

  return data;
}

function readReference(sheet: BookSheet, data: BookData, systemCode: string): void {
  const subsystems = findHeader(sheet, ["система", "название", "код подсистемы"]);
  if (subsystems) {
    for (const { get } of tableRows(sheet, subsystems, "код подсистемы")) {
      const code = text(get("код подсистемы"));
      if (code) data.subsystems.push({ system: text(get("система")) || systemCode, code, name: text(get("название")) || code });
    }
    data.found.push(`«${sheet.name}», строка ${subsystems.row + 1}: подсистемы — ${data.subsystems.length}`);
  } else data.problems.push(`«${sheet.name}»: таблица подсистем не найдена`);

  const stages = findHeader(sheet, ["код этапа", "название", "уровень"], ["порядок"]);
  if (stages) {
    for (const { get } of tableRows(sheet, stages, "код этапа")) {
      const order = Number(text(get("порядок")));
      data.stages.push({
        code: text(get("код этапа")),
        name: text(get("название")) || text(get("код этапа")),
        level: stageLevel(text(get("уровень"))),
        sortOrder: Number.isFinite(order) && order > 0 ? order : data.stages.length + 1,
      });
    }
    data.found.push(`«${sheet.name}», строка ${stages.row + 1}: этапы — ${data.stages.length}`);
  } else data.problems.push(`«${sheet.name}»: таблица этапов не найдена`);

  const modules = findHeader(sheet, ["№ мс", "название", "подсистема", "система", "версия"]);
  if (modules) {
    // «№ МС» и «№ МС в подсистеме» начинаются одинаково: вторую ищем точно.
    const inSubsystem = sheet.rows[modules.row].findIndex((cell) => /в\s+подсистеме/i.test(text(cell)));
    const byName = new Map(data.subsystems.map((item) => [item.name.toLowerCase(), item.code]));
    for (const { r, get } of tableRows(sheet, modules, "№ мс")) {
      const number = Number(text(get("№ мс")));
      const name = text(get("название"));
      if (!Number.isInteger(number) || number < 1 || !name) continue;
      const subsystemText = text(get("подсистема"));
      const subsystem = byName.get(subsystemText.toLowerCase()) ?? subsystemText;
      const own = inSubsystem >= 0 ? Number(text(sheet.rows[r][inSubsystem])) : NaN;
      data.modules.push({
        system: text(get("система")) || systemCode,
        number,
        name,
        subsystem,
        subsystemNumber: Number.isInteger(own) && own > 0 ? own : null,
        version: text(get("версия")) || null,
      });
    }
    data.found.push(`«${sheet.name}», строка ${modules.row + 1}: реестр МС — ${data.modules.length}`);
  } else data.problems.push(`«${sheet.name}»: реестр МС не найден`);

  // Колонка «Приоритет ОФТ» рядом с таблицей — список значений для выбора
  // (Высокий, Средний, Низкий), а не приоритет направления: приоритет в
  // книге стоит у разделов на листе «ОФТ». Поэтому здесь он не читается.
  const directions = findHeader(sheet, ["код", "название", "область"]);
  if (directions) {
    const rows = [...tableRows(sheet, directions, "код")].map(({ get }) => ({
      code: text(get("код")),
      name: text(get("название")),
      area: text(get("область")).replace(/^[—-]$/, "") || null,
    }));
    // Область — это код, на который ссылаются другие строки: TA для TATep.
    const areas = new Set(rows.flatMap((row) => (row.area ? [row.area] : [])));
    data.areas = rows.filter((row) => areas.has(row.code)).map(({ code, name }) => ({ code, name }));
    data.directions = rows.filter((row) => !areas.has(row.code));
    data.found.push(
      `«${sheet.name}», строка ${directions.row + 1}: направления — ${data.directions.length}, области — ${areas.size}`,
    );
  } else data.problems.push(`«${sheet.name}»: таблица областей и направлений не найдена`);
}

/** Листы «ОФТ» и «Дорожная карта»: коды направлений, разделов и пунктов. */
function readCodes(sheet: BookSheet, data: BookData, systemCode: string): void {
  const header = findHeader(sheet, ["код", "наименование"], ["отв", "статус", "срок"]);
  if (!header) {
    data.problems.push(`«${sheet.name}»: шапка «Код · Наименование» не найдена`);
    return;
  }
  let parts = 0;
  let dks = 0;
  for (let r = header.row + 1; r < sheet.rows.length; r += 1) {
    const row = sheet.rows[r];
    const get = (label: string) => row[header.cols.get(label) ?? -1];
    const code = text(get("код"));
    const match = code.match(CODE);
    if (!match || match[1] !== systemCode) continue;
    const [, , direction, part, number] = match;
    const name = text(get("наименование"));

    if (data.areas.some((item) => item.code === direction)) continue;
    if (!part) {
      const known = data.directions.find((item) => item.code === direction);
      if (!known) data.directions.push({ code: direction, name: name || direction, area: null });
      else if (!known.name) known.name = name;
      continue;
    }
    if (!data.directions.some((item) => item.code === direction)) {
      data.problems.push(`«${sheet.name}», строка ${r + 1}: ${code} — направления ${direction} нет в справочнике`);
      data.directions.push({ code: direction, name: direction, area: null });
    }
    if (!number) {
      if (!data.parts.some((item) => item.direction === direction && item.code === part)) {
        data.parts.push({ direction, code: part, name: name || part });
        parts += 1;
      }
      continue;
    }
    if (!data.parts.some((item) => item.direction === direction && item.code === part)) {
      data.problems.push(`«${sheet.name}», строка ${r + 1}: ${code} — раздела ${direction}.${part} нет`);
      data.parts.push({ direction, code: part, name: part });
    }
    const status = header.cols.has("статус") ? text(get("статус")) : "";
    const existing = data.dks.find((item) => item.direction === direction && item.part === part && item.number === Number(number));
    if (existing) {
      data.problems.push(`«${sheet.name}», строка ${r + 1}: пункт ${code} повторяется`);
      continue;
    }
    data.dks.push({
      direction,
      part,
      number: Number(number),
      name: name || code,
      status: dkStatusOf(status),
      deadline: header.cols.has("срок") ? asDate(get("срок")) : null,
      owner: header.cols.has("отв") ? text(get("отв")) || null : null,
    });
    dks += 1;
  }
  data.found.push(`«${sheet.name}», строка ${header.row + 1}: разделы — ${parts}, пункты — ${dks}`);
  if (!data.systemName) {
    const system = sheet.rows.find((row) => text(row[header.cols.get("код")!]) === systemCode);
    if (system) data.systemName = text(system[header.cols.get("наименование")!]) || null;
  }
}

/**
 * Лист «План работ». Строка МС (TA.1) несёт код пункта дорожной карты, строки
 * задач под ней (TA.1.Р2) ссылаются на него. Сроки — закрашенные месяцы
 * шкалы: старт — первый день первого месяца, финиш — последний день
 * последнего. Без закраски — месяц срока из колонки «Срок».
 */
function readPlan(sheets: BookSheet[], sheet: BookSheet, data: BookData, systemCode: string): void {
  const header = findHeader(sheet, ["код бизнес", "код мс", "наименование"], ["статус", "срок"]);
  if (!header) {
    data.problems.push(`«${sheet.name}»: шапка «Код Бизнес · Код МС» не найдена`);
    return;
  }
  const yearRow = sheet.rows[header.row];
  const monthRow = sheet.rows[header.row + 1] ?? [];
  const months = new Map<number, Date>();
  let year: number | null = null;
  const fixed = Math.max(...header.cols.values());
  for (let c = fixed + 1; c < Math.max(yearRow.length, monthRow.length); c += 1) {
    const y = Number(text(yearRow[c]));
    if (Number.isInteger(y) && y > 2000) year = y;
    const month = MONTHS.indexOf(text(monthRow[c]).toLowerCase().slice(0, 3));
    if (year !== null && month >= 0) months.set(c, new Date(year, month, 1));
  }
  if (months.size === 0) data.problems.push(`«${sheet.name}»: шкала месяцев не найдена, сроки возьмутся из «Срок»`);

  const stageCodes = new Set(data.stages.map((item) => item.code));
  const registry = new Set(
    data.modules.filter((item) => item.system === systemCode).map((item) => `${item.subsystem}.${item.subsystemNumber}`),
  );
  const get = (row: BookCell[], label: string) => row[header.cols.get(label) ?? -1];
  let skipped = 0;

  for (let r = header.row + 2; r < sheet.rows.length; r += 1) {
    const row = sheet.rows[r];
    const ms = text(get(row, "код мс"));
    const match = ms.match(MS_CODE);
    if (!match) {
      if (ms) data.problems.push(`«${sheet.name}», строка ${r + 1}: код МС «${ms}» не по правилу ПОДСИСТЕМА.МС.ЭТАП — строка пропущена`);
      continue;
    }
    if (!match[2]) continue;
    const [, subsystem, msNumber, stage, repeat] = match;
    if (!stage) {
      if (!registry.has(`${subsystem}.${msNumber}`)) {
        data.problems.push(`«${sheet.name}», строка ${r + 1}: МС ${subsystem}.${msNumber} нет в реестре МС`);
      }
      continue;
    }

    const where = `«${sheet.name}», строка ${r + 1}, ${ms}`;
    const business = resolveCell(sheets, sheet, get(row, "код бизнес"));
    const code = business.match(CODE);
    if (!code || code[1] !== systemCode || !code[3] || !code[4]) {
      data.problems.push(`${where}: код пункта дорожной карты не определён («${business || "пусто"}»)`);
      skipped += 1;
      continue;
    }
    if (!stageCodes.has(stage)) {
      data.problems.push(`${where}: этапа «${stage}» нет в справочнике`);
      skipped += 1;
      continue;
    }

    const filled = [...months.entries()].filter(([c]) => row[c]?.fill).map(([, month]) => month);
    const deadline = asDate(get(row, "срок"));
    let startDate: Date | null = null;
    let finishDate: Date | null = null;
    if (filled.length) {
      startDate = filled[0];
      const last = filled[filled.length - 1];
      finishDate = new Date(last.getFullYear(), last.getMonth() + 1, 0);
      if (deadline && (deadline < startDate || deadline > finishDate)) {
        data.problems.push(`${where}: срок ${text(get(row, "срок"))} не совпадает с закраской шкалы — взята шкала`);
      }
    } else if (deadline) {
      startDate = new Date(deadline.getFullYear(), deadline.getMonth(), 1);
      finishDate = deadline;
    }

    data.tasks.push({
      row: r + 1,
      direction: code[2],
      part: code[3],
      dk: Number(code[4]),
      subsystem,
      msNumber: Number(msNumber),
      stage,
      repeat: repeat ? Number(repeat) : 1,
      name: text(get(row, "наименование")) || stage,
      status: text(get(row, "статус")) || null,
      startDate,
      finishDate,
    });
  }
  data.found.push(
    `«${sheet.name}», строка ${header.row + 1}: задачи — ${data.tasks.length}${skipped ? `, пропущено ${skipped}` : ""}`,
  );
}
