import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import type { VisibilityEntity } from "@/lib/visibility";
import { normalizeHeader } from "@/lib/excel/columns";
import {
  DOCUMENT_COLUMNS,
  LETTER_COLUMNS,
  TASK_COLUMNS,
  isSummaryTitle,
  matchColumns,
  parseLetterDirection,
  parseLetterStatus,
  isRefusalNote,
  parsePartyStatus,
  parsePriority,
  partyFromHeader,
  type TaskColumn,
} from "@/lib/excel/columns";
import {
  completionDate,
  inferStatusFromChronicle,
  parseChronicle,
} from "@/lib/excel/chronicle";
import { deriveDocumentStatus, documentKindLabel } from "@/lib/domain";
import { buildSearchIndex } from "@/lib/search";
import { ensureProjectTracks } from "@/lib/tracks";
import { cellDate, cellNumber, cellText } from "@/lib/excel/parse-cell";

export type ImportRowError = { row: number; message: string };

/** Что за реестр загружаем: реестры задач и переписки устроены по-разному. */
export type ImportKind = "tasks" | "letters" | "documents";

export type SheetPreview = {
  name: string;
  rowCount: number;
  headerRow: number | null;
  recognizedColumns: string[];
  suggestedKind: ImportKind | null;
};

export type ImportReport = {
  fileName: string;
  kind: ImportKind;
  sheetName: string | null;
  headerRow: number | null;
  recognizedColumns: string[];
  rowsTotal: number;
  created: number;
  updated: number;
  skipped: number;
  notesCreated: number;
  membersCreated: string[];
  counterpartiesCreated: string[];
  errors: ImportRowError[];
  sheets: SheetPreview[];
};

export type ImportOptions = {
  projectId: string;
  kind: ImportKind;
  /** Вид документа для реестра подписания: в файле он задан названием листа. */
  documentKind?: string;
  /** Лист книги. Пусто — берём наиболее подходящий под выбранный вид реестра. */
  sheetName?: string;
  createMissingMembers: boolean;
  createMissingCounterparties: boolean;
  dryRun: boolean;
  /** Видимость новых записей: реестр вносят пачкой, и решение о нём одно. */
  isPublic: boolean;
  /**
   * Применить видимость и к записям, которые уже заведены. По умолчанию нет:
   * видимость — решение человека, а загрузку повторяют ради данных, и молча
   * откатывать ею открытые письма нельзя.
   */
  applyToExisting: boolean;
  /**
   * Кто загружает. Видимость уже заведённой записи меняет только
   * администратор, и каждая такая смена попадает в журнал видимости.
   */
  actor: { id: string; isAdmin: boolean };
};

/**
 * Видимость при обновлении уже заведённой записи. По умолчанию не меняется:
 * загрузку повторяют ради данных, а не ради того, чтобы откатить чужое
 * решение. Меняет её только администратор и только по явной просьбе — и
 * такая смена попадает в журнал видимости.
 */
async function visibilityOnUpdate(
  options: ImportOptions,
  entity: VisibilityEntity,
  entityId: string,
  title: string,
  current: boolean,
): Promise<{ isPublic?: boolean }> {
  if (!options.applyToExisting) return {};
  if (!options.actor.isAdmin || current === options.isPublic) return {};

  await prisma.visibilityChange.create({
    data: {
      entity,
      entityId,
      title,
      isPublic: options.isPublic,
      memberId: options.actor.id,
    },
  });
  return { isPublic: options.isPublic };
}

/** Сколько первых строк просматриваем в поисках шапки: над таблицей бывает заголовок. */
const HEADER_SEARCH_DEPTH = 10;

type Header = { rowNumber: number; columns: Map<number, string> };

export async function importFromXlsx(
  buffer: ArrayBuffer,
  fileName: string,
  options: ImportOptions,
): Promise<ImportReport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = previewSheets(workbook);
  const report: ImportReport = {
    fileName,
    kind: options.kind,
    sheetName: null,
    headerRow: null,
    recognizedColumns: [],
    rowsTotal: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    notesCreated: 0,
    membersCreated: [],
    counterpartiesCreated: [],
    errors: [],
    sheets,
  };

  const sheet = pickSheet(workbook, options, sheets);
  if (!sheet) {
    report.errors.push({
      row: 0,
      message: options.sheetName
        ? `Лист «${options.sheetName}» не найден в файле`
        : "Не удалось определить подходящий лист — выберите его вручную",
    });
    return report;
  }
  report.sheetName = sheet.name;

  const schema = schemaFor(options.kind);
  const header = findHeader(sheet, schema, options.kind);
  if (!header) {
    report.errors.push({ row: 0, message: headerHint(options.kind) });
    return report;
  }

  report.headerRow = header.rowNumber;
  report.recognizedColumns = [...header.columns.values()];

  const rows = readRows(sheet, header);
  report.rowsTotal = rows.length;

  if (options.dryRun) {
    report.skipped = rows.length;
    return report;
  }

  if (options.kind === "letters") {
    await importLetters(rows, options, report);
  } else if (options.kind === "documents") {
    await importDocuments(sheet, header, rows, options, report);
  } else {
    await importTasks(rows, options, report);
  }

  await prisma.importBatch.create({
    data: {
      fileName: `${fileName} · ${sheet.name}`,
      projectId: options.projectId,
      rowsTotal: report.rowsTotal,
      rowsCreated: report.created,
      rowsUpdated: report.updated,
      rowsSkipped: report.skipped,
      errorsJson: report.errors.length > 0 ? JSON.stringify(report.errors) : null,
    },
  });

  return report;
}

/* ─── Разбор книги ────────────────────────────────────────────────────────── */

function schemaFor(kind: ImportKind): TaskColumn[] {
  if (kind === "letters") return LETTER_COLUMNS;
  if (kind === "documents") return DOCUMENT_COLUMNS;
  return TASK_COLUMNS;
}

/**
 * Краткая сводка по каждому листу: пользователю надо видеть, что в файле.
 * Реестр подписания распознаётся по колонкам «Статус подписания <сторона>» —
 * без этого его легко принять за список задач и загрузить мусор.
 */
function previewSheets(workbook: ExcelJS.Workbook): SheetPreview[] {
  return workbook.worksheets.map((sheet) => {
    const asDocuments = findHeader(sheet, DOCUMENT_COLUMNS, "documents");
    const asLetters = findHeader(sheet, LETTER_COLUMNS, "letters");
    const asTasks = findHeader(sheet, TASK_COLUMNS, "tasks");

    const parties = asDocuments ? partyColumns(sheet, asDocuments.rowNumber).size : 0;
    const letterScore = asLetters?.columns.size ?? 0;
    const taskScore = asTasks?.columns.size ?? 0;

    let suggestedKind: ImportKind | null = null;
    let header = null;
    if (parties >= 1 && asDocuments) {
      suggestedKind = "documents";
      header = asDocuments;
    } else if (letterScore > taskScore) {
      suggestedKind = "letters";
      header = asLetters;
    } else if (taskScore > 0) {
      suggestedKind = "tasks";
      header = asTasks;
    }

    return {
      name: sheet.name,
      rowCount: Math.max(0, sheet.rowCount - (header?.rowNumber ?? 0)),
      headerRow: header?.rowNumber ?? null,
      recognizedColumns: header
        ? [
            ...header.columns.values(),
            ...(suggestedKind === "documents" ? [`стороны: ${parties}`] : []),
          ]
        : [],
      suggestedKind,
    };
  });
}

/**
 * Колонки статусов сторон: { columnIndex -> название стороны }.
 * Одна сторона может встретиться дважды («Статус ДИТ» и «Статус подписания ДИТ»):
 * в реестре первая — стадия работы, вторая — сама подпись, её и берём.
 */
function partyColumns(sheet: ExcelJS.Worksheet, headerRow: number): Map<number, string> {
  const best = new Map<string, { index: number; rank: number }>();

  rowValues(sheet.getRow(headerRow)).forEach((raw, index) => {
    const party = partyFromHeader(raw);
    if (!party) return;

    const rank = String(raw).toLowerCase().includes("подписан") ? 2 : 1;
    const current = best.get(party);
    if (!current || rank > current.rank) best.set(party, { index: index + 1, rank });
  });

  return new Map([...best.entries()].map(([party, { index }]) => [index, party]));
}

/**
 * Есть ли на листе колонки «Статус подписания <сторона>».
 * Если есть — стороны берутся только из них, а «Статус согласования» остаётся
 * текстом. Если нет, как в реестре допсоглашений, статус согласования и есть
 * статус контрагента: другой колонки под него в файле не предусмотрено.
 */
function hasSigningHeaders(sheet: ExcelJS.Worksheet, headerRow: number): boolean {
  return rowValues(sheet.getRow(headerRow)).some(
    (raw) => partyFromHeader(raw) !== null && String(raw).toLowerCase().includes("подписан"),
  );
}

/** «Письмо № 64-03-604/25 от 01.10.2025» — дату письма забираем в дату события. */
const REQUISITE_DATE = /(?:^|\s)от\s+(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/;

function prefixed(label: string, value: string | null): { occurredOn: Date; body: string } | null {
  if (!value) return null;
  const match = REQUISITE_DATE.exec(value);
  const occurredOn = match
    ? new Date(
        match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1]),
      )
    : new Date();
  return {
    occurredOn: Number.isNaN(occurredOn.getTime()) ? new Date() : occurredOn,
    body: `${label}: ${value}`,
  };
}

function pickSheet(
  workbook: ExcelJS.Workbook,
  options: ImportOptions,
  sheets: SheetPreview[],
): ExcelJS.Worksheet | null {
  if (options.sheetName) {
    return workbook.worksheets.find((sheet) => sheet.name === options.sheetName) ?? null;
  }
  const best = sheets
    .filter((sheet) => sheet.suggestedKind === options.kind)
    .sort((a, b) => b.recognizedColumns.length - a.recognizedColumns.length)[0];
  return best ? (workbook.worksheets.find((sheet) => sheet.name === best.name) ?? null) : null;
}

/**
 * Шапка не всегда в первой строке: над таблицей часто стоят название отчёта
 * и пустые строки. Ищем первую строку с обязательной колонкой и ещё одной.
 */
function findHeader(
  sheet: ExcelJS.Worksheet,
  schema: TaskColumn[],
  kind: ImportKind,
): Header | null {
  const depth = Math.min(HEADER_SEARCH_DEPTH, sheet.rowCount);

  for (let rowNumber = 1; rowNumber <= depth; rowNumber += 1) {
    const columns = matchColumns(rowValues(sheet.getRow(rowNumber)), schema);
    const keys = new Set(columns.values());

    const anchor =
      kind === "letters"
        ? keys.has("number") || keys.has("subject")
        : kind === "documents"
          ? keys.has("counterparty")
          : keys.has("title");

    if (anchor && keys.size >= 3) return { rowNumber, columns };
  }
  return null;
}

function headerHint(kind: ImportKind): string {
  if (kind === "documents") {
    return "Не удалось найти шапку реестра подписания. Нужна колонка с организацией и минимум две колонки вида «Статус подписания <сторона>»";
  }
  return kind === "letters"
    ? "Не удалось найти шапку реестра переписки. Нужны колонки «Номер письма» или «Тема» и ещё минимум две из: Дата, Тип, Контрагент, Срок исполнения, Статус"
    : "Не удалось найти шапку таблицы задач. Нужна колонка с названием задачи и ещё минимум две из: Статус, Ответственный, Срок, Дата создания";
}

function rowValues(row: ExcelJS.Row): unknown[] {
  const values = row.values;
  if (!Array.isArray(values)) return [];
  // ExcelJS нумерует колонки с единицы и держит values[0] пустым.
  return values.slice(1);
}

type RawRow = { rowNumber: number; cells: Map<string, ExcelJS.CellValue> };

function readRows(sheet: ExcelJS.Worksheet, header: Header): RawRow[] {
  const rows: RawRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;

    const cells = new Map<string, ExcelJS.CellValue>();
    header.columns.forEach((key, index) => {
      cells.set(key, row.getCell(index + 1).value);
    });
    rows.push({ rowNumber, cells });
  });

  return rows;
}

/* ─── Задачи ──────────────────────────────────────────────────────────────── */

async function importTasks(
  rows: RawRow[],
  options: ImportOptions,
  report: ImportReport,
): Promise<void> {
  const members = await loadMemberIndex();
  const tracks = await loadTrackIndex(options.projectId);
  const existing = await prisma.task.findMany({
    where: { projectId: options.projectId },
    select: { id: true, externalKey: true, title: true },
  });
  const byExternalKey = new Map(
    existing.filter((task) => task.externalKey).map((task) => [task.externalKey!, task.id]),
  );
  const byTitle = new Map(existing.map((task) => [task.title.toLowerCase(), task.id]));
  let nextNumber = await nextTaskNumber(options.projectId);

  for (const row of rows) {
    const title = cellText(row.cells.get("title") ?? null);
    if (!title || isSummaryTitle(title)) continue;

    try {
      const rawStatus = cellText(row.cells.get("status") ?? null) ?? "";
      const chronicle = parseChronicle(rawStatus);
      const status = inferStatusFromChronicle(rawStatus, chronicle);
      const rawAssignee = cellText(row.cells.get("assignee") ?? null);
      const assigneeName = firstEntry(rawAssignee);

      const data = {
        title,
        // Если ответственных несколько, ячейка сохраняется целиком: в файле там
        // бывает разделение зон («первая — техническая фактура, вторая —
        // переписка»), и оно ценнее аккуратного списка фамилий.
        description:
          [
            cellText(row.cells.get("description") ?? null),
            hasMoreEntries(rawAssignee) ? `Ответственные: ${rawAssignee}` : null,
          ]
            .filter(Boolean)
            .join("\n\n") || null,
        status,
        priority: parsePriority(cellText(row.cells.get("priority") ?? null)) ?? "MEDIUM",
        trackId: await resolveTrack(cellText(row.cells.get("track") ?? null), tracks, options),
        assigneeId: await resolveMember(assigneeName, members, options, report),
        externalAssignee: cellText(row.cells.get("externalAssignee") ?? null),
        // Журнал остаётся целиком: лента ниже его разбирает, но текст не теряем.
        progressNote: rawStatus.length > 0 ? rawStatus : null,
        startDate: cellDate(row.cells.get("startDate") ?? null),
        dueDate: cellDate(row.cells.get("dueDate") ?? null),
        estimateHours: cellNumber(row.cells.get("estimateHours") ?? null),
        spentHours: cellNumber(row.cells.get("spentHours") ?? null),
        progress: clampProgress(cellNumber(row.cells.get("progress") ?? null), status),
        completedAt: status === "DONE" ? (completionDate(chronicle) ?? new Date()) : null,
      };

      const externalKey = cellText(row.cells.get("externalKey") ?? null);
      // Поисковая строка готовится при записи: без неё перенесённые задачи
      // не находились бы поиском по реестру.
      const searchIndex = buildSearchIndex([
        data.title,
        data.description,
        data.progressNote,
        data.externalAssignee,
        externalKey,
      ]);
      const existingId =
        (externalKey ? byExternalKey.get(externalKey) : undefined) ??
        byTitle.get(title.toLowerCase());

      const taskId = existingId
        ? (
            await prisma.task.update({
              where: { id: existingId },
              data: {
                ...data,
                searchIndex,
                ...(await visibilityOnUpdate(
                  options,
                  "TASK",
                  existingId,
                  title,
                  (await prisma.task.findUniqueOrThrow({
                    where: { id: existingId },
                    select: { isPublic: true },
                  })).isPublic,
                )),
              },
            })
          ).id
        : (
            await prisma.task.create({
              data: {
                ...data,
                searchIndex,
                isPublic: options.isPublic,
                projectId: options.projectId,
                number: nextNumber,
                sortOrder: nextNumber,
                externalKey,
              },
            })
          ).id;

      if (existingId) {
        report.updated += 1;
      } else {
        byTitle.set(title.toLowerCase(), taskId);
        if (externalKey) byExternalKey.set(externalKey, taskId);
        nextNumber += 1;
        report.created += 1;
      }

      await syncResultArtifact(taskId, cellText(row.cells.get("resultLink") ?? null));
      report.notesCreated += await syncChronicle({ taskId }, chronicle);
    } catch (error) {
      report.skipped += 1;
      report.errors.push({ row: row.rowNumber, message: errorMessage(error) });
    }
  }
}

/* ─── Переписка ───────────────────────────────────────────────────────────── */

async function importLetters(
  rows: RawRow[],
  options: ImportOptions,
  report: ImportReport,
): Promise<void> {
  const counterparties = await loadCounterpartyIndex();
  const existing = await prisma.letter.findMany({
    where: { projectId: options.projectId },
    select: { id: true, number: true, direction: true },
  });
  const byKey = new Map(
    existing.map((letter) => [`${letter.number}|${letter.direction}`, letter.id]),
  );

  for (const row of rows) {
    const number = cellText(row.cells.get("number") ?? null);
    const subject = cellText(row.cells.get("subject") ?? null);
    if (!number && !subject) continue;
    if (subject && isSummaryTitle(subject)) continue;

    try {
      const direction =
        parseLetterDirection(cellText(row.cells.get("direction") ?? null)) ?? "INCOMING";
      const rawStatus = cellText(row.cells.get("status") ?? null) ?? "";
      const status = parseLetterStatus(rawStatus) ?? "IN_PROGRESS";
      const rawCounterparty = cellText(row.cells.get("counterparty") ?? null);
      const counterpartyName = firstEntry(rawCounterparty);

      const data = {
        number: number ?? "б/н",
        direction,
        date: cellDate(row.cells.get("date") ?? null),
        subject: subject ?? "Без темы",
        url: cellText(row.cells.get("url") ?? null),
        counterpartyId: await resolveCounterparty(
          counterpartyName,
          counterparties,
          options,
          report,
        ),
        dueDate: cellDate(row.cells.get("dueDate") ?? null),
        status,
        // Исходный текст статуса сохраняем: там детали, которых нет в справочнике.
        statusNote: rawStatus && parseLetterStatus(rawStatus) === null ? rawStatus : null,
        responseRef: cellText(row.cells.get("responseRef") ?? null),
        externalTaskKey: cellText(row.cells.get("externalTaskKey") ?? null),
        comment:
          hasMoreEntries(rawCounterparty)
            ? [cellText(row.cells.get("comment") ?? null), `Адресаты: ${rawCounterparty}`]
                .filter(Boolean)
                .join("\n")
            : cellText(row.cells.get("comment") ?? null),
        closedAt: ["ANSWERED", "SIGNED", "NOTED", "CLOSED"].includes(status) ? new Date() : null,
      };

      const withSearch = {
        ...data,
        searchIndex: buildSearchIndex([
          data.number,
          data.subject,
          counterpartyName,
          rawCounterparty,
          data.responseRef,
          data.statusNote,
          data.comment,
          data.externalTaskKey,
        ]),
      };

      const key = `${data.number}|${direction}`;
      const existingId = byKey.get(key);

      if (existingId) {
        const before = await prisma.letter.findUniqueOrThrow({
          where: { id: existingId },
          select: { isPublic: true },
        });
        await prisma.letter.update({
          where: { id: existingId },
          data: {
            ...withSearch,
            ...(await visibilityOnUpdate(
              options,
              "LETTER",
              existingId,
              `№ ${data.number} — ${data.subject}`,
              before.isPublic,
            )),
          },
        });
        report.updated += 1;
      } else {
        const created = await prisma.letter.create({
          data: { ...withSearch, isPublic: options.isPublic, projectId: options.projectId },
        });
        byKey.set(key, created.id);
        report.created += 1;
      }
    } catch (error) {
      report.skipped += 1;
      report.errors.push({ row: row.rowNumber, message: errorMessage(error) });
    }
  }
}

/* ─── Реестр подписания ───────────────────────────────────────────────────── */

/**
 * Строка реестра — это документ по одной организации, а колонки
 * «Статус подписания <сторона>» — независимые статусы сторон. Линейным статусом
 * это не описывается, поэтому каждая колонка становится отдельной подписью.
 */
async function importDocuments(
  sheet: ExcelJS.Worksheet,
  header: Header,
  rows: RawRow[],
  options: ImportOptions,
  report: ImportReport,
): Promise<void> {
  const parties = partyColumns(sheet, header.rowNumber);
  const explicitSigning = hasSigningHeaders(sheet, header.rowNumber);
  if (parties.size === 0) {
    report.errors.push({
      row: header.rowNumber,
      message: "На листе нет колонок «Статус подписания <сторона>» — импортировать нечего",
    });
    return;
  }
  report.recognizedColumns.push(...[...parties.values()].map((party) => `сторона: ${party}`));

  const counterparties = await loadCounterpartyIndex();
  const members = await loadMemberIndex();
  const kind = options.documentKind ?? "REGULATION";

  // Заголовок колонки с организацией («РСО») повторяется в названии одной из
  // колонок подписания («Статус подписания РСО»). Это не обобщённая сторона, а
  // подстановка организации строки, и такую сторону связываем со справочником.
  const counterpartyHeaderIndex = [...header.columns.entries()].find(
    ([, key]) => key === "counterparty",
  )?.[0];
  // Ключи шапки нумеруются с нуля, ячейки листа — с единицы.
  const counterpartyParty =
    counterpartyHeaderIndex === undefined
      ? null
      : normalizeHeader(
          sheet.getRow(header.rowNumber).getCell(counterpartyHeaderIndex + 1).value,
        );

  for (const row of rows) {
    const rawCounterparty = cellText(row.cells.get("counterparty") ?? null);
    const counterpartyName = firstEntry(rawCounterparty);
    if (!counterpartyName || isSummaryTitle(counterpartyName)) continue;

    try {
      const counterpartyId = await resolveCounterparty(
        counterpartyName,
        counterparties,
        options,
        report,
      );
      const title =
        cellText(row.cells.get("title") ?? null) ??
        `${documentKindLabel(kind)} — ${counterpartyName}`;

      const signatures = [...parties.entries()]
        .map(([columnIndex, party], order) => {
          const raw = cellText(sheet.getRow(row.rowNumber).getCell(columnIndex).value);
          return {
            party,
            // Заголовок «Статус подписания РСО» — подстановка организации
            // строки; остальные стороны ищем в справочнике по названию.
            // Несвязанная сторона — это не «мы»: соседний департамент такая же
            // внешняя сторона, поэтому свою организацию отмечают флагом.
            counterpartyId:
              counterpartyParty && normalizeHeader(party) === counterpartyParty
                ? counterpartyId
                : (counterparties.get(normalizeHeader(party)) ?? null),
            status: parsePartyStatus(raw) ?? "PENDING",
            note: raw && parsePartyStatus(raw) === null ? raw : null,
            sortOrder: order,
          };
        });

      // «Статус согласования» без колонок подписания — это статус контрагента.
      // В реестре регламентов та же колонка содержит свободный текст с датами,
      // поэтому решает не заголовок, а значение: стороной она становится,
      // только если в ячейке стоит слово из словаря статусов.
      const approvalRaw = cellText(row.cells.get("approvalNote") ?? null);
      // Длинная ячейка — это комментарий, даже если начинается со слова из
      // словаря: «На рассмотрении. В рабочем порядке сообщили…» статусом не является.
      const approvalStatus =
        explicitSigning || !approvalRaw || approvalRaw.length > 40
          ? null
          : parsePartyStatus(approvalRaw);
      if (approvalStatus && ![...parties.values()].includes(counterpartyName)) {
        signatures.unshift({
          party: counterpartyName,
          counterpartyId,
          status: approvalStatus,
          note: null,
          sortOrder: -1,
        });
      }

      // Статус согласования, который не свёлся к словарю, — это хроника.
      // Датированные куски уходят лентой, недатированные остаются в примечании:
      // терять их нельзя, в реестре регламентов там половина смысла строки.
      const approvalChronicle = approvalStatus || !approvalRaw ? [] : parseChronicle(approvalRaw);
      const undatedApproval = approvalChronicle
        .filter((entry) => !entry.occurredOn)
        .map((entry) => entry.body);

      // Итоговая колонка реестра важнее промежуточной: берём её, если есть.
      const finalStatus = cellText(row.cells.get("finalStatus") ?? null);
      const statusNote = [
        finalStatus,
        cellText(row.cells.get("statusNote") ?? null),
        ...undatedApproval,
      ]
        .filter(Boolean)
        .join(" · ") || null;
      const data = {
        kind,
        title,
        counterpartyId,
        ownerId: await resolveMember(
          firstEntry(cellText(row.cells.get("owner") ?? null)),
          members,
          options,
          report,
        ),
        // Итоговая колонка реестра авторитетнее: там фиксируют отказ,
        // даже когда отдельные стороны успели подписать.
        status:
          isRefusalNote(finalStatus) || isRefusalNote(statusNote)
            ? "DECLINED"
            : deriveDocumentStatus(signatures, "DRAFT"),
        statusNote,
        nextAction: cellText(row.cells.get("nextAction") ?? null),
        dueDate: cellDate(row.cells.get("dueDate") ?? null),
        // Поисковая строка готовится при записи: без неё перенесённые
        // документы не находились бы поиском по юридическому треку.
        searchIndex: buildSearchIndex([
          title,
          counterpartyName,
          statusNote,
          cellText(row.cells.get("nextAction") ?? null),
        ]),
      };

      const existing = await prisma.document.findFirst({
        where: { projectId: options.projectId, title },
      });

      let documentId: string;
      if (existing) {
        await prisma.document.update({
          where: { id: existing.id },
          data: {
            ...data,
            ...(await visibilityOnUpdate(
              options,
              "DOCUMENT",
              existing.id,
              title,
              existing.isPublic,
            )),
          },
        });
        // Стороны пересобираем целиком: в реестре они и есть источник правды.
        await prisma.documentSignature.deleteMany({ where: { documentId: existing.id } });
        await prisma.documentSignature.createMany({
          data: signatures.map((item) => ({ ...item, documentId: existing.id })),
        });
        documentId = existing.id;
        report.updated += 1;
      } else {
        const created = await prisma.document.create({
          data: {
            ...data,
            isPublic: options.isPublic,
            projectId: options.projectId,
            signatures: { create: signatures },
          },
        });
        documentId = created.id;
        report.created += 1;
      }

      // Если статус согласования не свёлся к словарю, это хроника с датами —
      // в реестре регламентов там половина смысла строки. Кладём её лентой.
      if (approvalChronicle.length > 0) {
        report.notesCreated += await syncChronicle({ documentId }, approvalChronicle);
      }

      // Реквизиты писем-оснований и ссылка на карточку ЭДО. Связать их с
      // письмами реестра нельзя: в реестре переписки этих писем нет — он ведёт
      // другой год. Поэтому сохраняем текстом, а связывание остаётся за
      // человеком.
      const basis = [
        prefixed("Отправлено", cellText(row.cells.get("outgoingLetter") ?? null)),
        prefixed("Ответ", cellText(row.cells.get("incomingLetter") ?? null)),
        prefixed("Карточка ЭДО", cellText(row.cells.get("url") ?? null)),
      ].filter((entry) => entry !== null);
      if (basis.length > 0) {
        report.notesCreated += await syncChronicle({ documentId }, basis);
      }
    } catch (error) {
      report.skipped += 1;
      report.errors.push({ row: row.rowNumber, message: errorMessage(error) });
    }
  }
}

/* ─── Справочники и вспомогательное ───────────────────────────────────────── */

/**
 * В реестрах в одну ячейку пишут несколько имён через перенос строки
 * («Жаворонков — фактура\nГончарова — письмо»). Справочник от этого замусоривается,
 * поэтому берём первого, а исходный текст сохраняется в карточке отдельно.
 */
function firstEntry(value: string | null): string | null {
  if (!value) return null;
  const first = value
    .split(/[\r\n;]+/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  if (!first) return null;
  // Отрезаем пояснение после тире: «Гончарова - письмо» → «Гончарова».
  const cleaned = first.split(/\s+[-–—]\s+/)[0].trim();
  return cleaned.length === 0 || cleaned.length > 120 ? null : cleaned;
}

/** Были ли в ячейке ещё значения кроме первого — это стоит показать в карточке. */
function hasMoreEntries(value: string | null): boolean {
  if (!value) return false;
  return value.split(/[\r\n;]+/).filter((part) => part.trim().length > 0).length > 1;
}

async function resolveMember(
  name: string | null,
  index: Map<string, string>,
  options: ImportOptions,
  report: ImportReport,
): Promise<string | null> {
  if (!name) return null;
  const key = name.toLowerCase();
  const found = index.get(key);
  if (found) return found;
  if (!options.createMissingMembers) return null;

  const member = await prisma.member.create({ data: { fullName: name } });
  index.set(key, member.id);
  report.membersCreated.push(name);
  return member.id;
}

/**
 * Одна организация пишется в файле по-разному («ПАО "Россети Московский Регион"»
 * и «ПАО Россети МР»), поэтому новые написания записываются псевдонимами.
 */
async function resolveCounterparty(
  name: string | null,
  index: Map<string, string>,
  options: ImportOptions,
  report: ImportReport,
): Promise<string | null> {
  if (!name) return null;
  const key = normalizeHeader(name);
  const found = index.get(key);
  if (found) return found;
  if (!options.createMissingCounterparties) return null;

  const counterparty = await prisma.counterparty.create({
    data: { name, aliases: { create: [{ alias: key }] } },
  });
  index.set(key, counterparty.id);
  report.counterpartiesCreated.push(name);
  return counterparty.id;
}

/** Записи журнала, которых ещё нет: повторный импорт не должен их дублировать. */
async function syncChronicle(
  target: { taskId: string } | { documentId: string },
  entries: { occurredOn: Date | null; body: string }[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const existing = await prisma.note.findMany({
    where: target,
    select: { body: true },
  });
  const known = new Set(existing.map((note) => note.body));

  const fresh = entries.filter((entry) => entry.occurredOn && !known.has(entry.body));
  if (fresh.length === 0) return 0;

  await prisma.note.createMany({
    data: fresh.map((entry) => ({ ...target, body: entry.body, occurredOn: entry.occurredOn! })),
  });
  return fresh.length;
}

async function loadMemberIndex(): Promise<Map<string, string>> {
  const members = await prisma.member.findMany({ select: { id: true, fullName: true } });
  return new Map(members.map((member) => [member.fullName.toLowerCase(), member.id]));
}

async function loadCounterpartyIndex(): Promise<Map<string, string>> {
  const [counterparties, aliases] = await Promise.all([
    prisma.counterparty.findMany({ select: { id: true, name: true, shortName: true } }),
    prisma.counterpartyAlias.findMany({ select: { alias: true, counterpartyId: true } }),
  ]);

  const index = new Map<string, string>();
  for (const item of counterparties) {
    index.set(normalizeHeader(item.name), item.id);
    if (item.shortName) index.set(normalizeHeader(item.shortName), item.id);
  }
  for (const alias of aliases) index.set(normalizeHeader(alias.alias), alias.counterpartyId);
  return index;
}

async function nextTaskNumber(projectId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

/**
 * Колонка «Результат» из файла становится артефактом задачи. Повторный импорт
 * той же строки не плодит дубли: артефакт с таким значением уже есть.
 */
async function syncResultArtifact(taskId: string, value: string | null): Promise<void> {
  const text = value?.trim();
  if (!text) return;

  const existing = await prisma.taskArtifact.findFirst({ where: { taskId, value: text } });
  if (existing) return;

  const kind = text.includes("mosedo")
    ? "EDO_LINK"
    : text.startsWith("http")
      ? "CUSTOM_LINK"
      : "CUSTOM_VALUE";
  const last = await prisma.taskArtifact.findFirst({
    where: { taskId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.taskArtifact.create({
    data: { taskId, kind, label: "Результат", value: text, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
}

/** Код базового трека по тексту ячейки. Незнакомое название кодом не считаем. */
function parseTrackKey(value: string | null): string | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return null;
  if (normalized.includes("производ")) return "PRODUCTION";
  if (normalized.includes("внутрен")) return "INTERNAL";
  if (normalized.includes("внеш")) return "EXTERNAL";
  if (normalized.includes("юрид") || normalized.includes("официал")) return "LEGAL";
  return null;
}

type TrackIndex = {
  byKey: Map<string, string>;
  byName: Map<string, string>;
  count: number;
};

/** Справочник треков проекта: по коду и по названию. */
async function loadTrackIndex(projectId: string): Promise<TrackIndex> {
  await ensureProjectTracks(projectId);
  const tracks = await prisma.track.findMany({ where: { projectId } });
  return {
    byKey: new Map(tracks.filter((item) => item.key).map((item) => [item.key!, item.id])),
    byName: new Map(tracks.map((item) => [item.name.trim().toLowerCase(), item.id])),
    count: tracks.length,
  };
}

/**
 * Трек строки импорта. Свой трек из файла заводится в справочник: перечень
 * треков ведёт команда, и файл — такой же источник, как форма.
 */
async function resolveTrack(
  value: string | null,
  tracks: TrackIndex,
  options: ImportOptions,
): Promise<string> {
  const name = value?.trim();
  if (name) {
    const byName = tracks.byName.get(name.toLowerCase());
    if (byName) return byName;

    const key = parseTrackKey(name);
    const byKey = key ? tracks.byKey.get(key) : undefined;
    if (byKey) return byKey;

    if (!options.dryRun) {
      const created = await prisma.track.create({
        data: { projectId: options.projectId, name, color: "gray", sortOrder: tracks.count },
      });
      tracks.byName.set(name.toLowerCase(), created.id);
      tracks.count += 1;
      return created.id;
    }
  }

  const production = tracks.byKey.get("PRODUCTION");
  if (production) return production;
  return [...tracks.byName.values()][0];
}

/** В Excel проценты хранятся долей единицы, поэтому 0.35 — это 35 %. */
function clampProgress(value: number | null, status: string): number {
  if (value === null) return status === "DONE" ? 100 : 0;
  const percent = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
