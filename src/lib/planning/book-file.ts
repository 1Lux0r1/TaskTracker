/**
 * Чтение книги планирования с диска в простые ячейки: значение, формула и
 * цвет заливки. Заливка нужна, потому что шкала «Плана работ» в книге —
 * закрашенные клетки месяцев, а не даты.
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { BookCell, BookSheet } from "./book";

/**
 * Книгу сохраняют программой, которая пишет связи листов абсолютными путями
 * (/xl/tables/…, /xl/comments/…), а ExcelJS ждёт относительные и падает.
 * Пути переписываются в относительные, а связи примечаний вырезаются: для
 * загрузки примечания не нужны.
 */
async function withoutComments(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  for (const name of Object.keys(zip.files)) {
    if (!/^xl\/worksheets\/_rels\/.+\.rels$/.test(name)) continue;
    const xml = await zip.file(name)!.async("string");
    const cleaned = xml
      .replace(/<Relationship\b[^>]*\/(comments|vmlDrawing)"[^>]*\/>/g, "")
      .replace(/Target="\/xl\//g, 'Target="../');
    if (cleaned !== xml) zip.file(name, cleaned);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

function plain(value: ExcelJS.CellValue): BookCell["value"] {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("result" in value) return value.result === undefined ? null : plain(value.result as ExcelJS.CellValue);
  if ("formula" in value || "sharedFormula" in value) return null;
  if ("text" in value) return String(value.text);
  return null;
}

export async function readBookFile(buffer: Buffer): Promise<BookSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await withoutComments(buffer)) as unknown as ArrayBuffer);
  return workbook.worksheets.map((sheet) => {
    const rows: BookCell[][] = [];
    for (let r = 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const cells: BookCell[] = [];
      for (let c = 1; c <= sheet.columnCount; c += 1) {
        const cell = row.getCell(c);
        const fill = cell.fill?.type === "pattern" && cell.fill.pattern === "solid" ? cell.fill.fgColor?.argb : undefined;
        const formula = cell.type === ExcelJS.ValueType.Formula ? cell.formula : undefined;
        cells.push({ value: plain(cell.value), ...(formula ? { formula } : {}), ...(fill ? { fill } : {}) });
      }
      rows.push(cells);
    }
    return { name: sheet.name, rows };
  });
}
