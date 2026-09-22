import type ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import {
  buildDocumentsWorkbook,
  buildImportTemplate,
  buildLettersWorkbook,
  buildReportWorkbook,
  buildTasksWorkbook,
} from "@/lib/excel/export";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * GET /api/export?entity=tasks|letters|documents|report&projectId=…&reportId=…
 * Без параметров выгружаются задачи по всем проектам.
 */
export async function GET(request: Request) {
  // Выгрузка отдаёт те же данные, что и экраны, поэтому закрыта так же.
  if (!(await getCurrentUser())) {
    return new Response("Требуется вход", { status: 401 });
  }

  const url = new URL(request.url);
  const entity = url.searchParams.get("entity") ?? "tasks";
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const reportId = url.searchParams.get("reportId") ?? undefined;

  if (url.searchParams.get("template") === "1") {
    return send(buildImportTemplate(), "tasktracker-template.xlsx");
  }

  switch (entity) {
    case "letters":
      return send(await buildLettersWorkbook(projectId), fileName("perepiska"));
    case "documents":
      return send(await buildDocumentsWorkbook(projectId), fileName("dokumenty"));
    case "report": {
      if (!reportId) return new Response("Не указан отчёт", { status: 400 });
      const workbook = await buildReportWorkbook(reportId);
      if (!workbook) return new Response("Отчёт не найден", { status: 404 });
      return send(workbook, fileName("otchet"));
    }
    default:
      return send(await buildTasksWorkbook(projectId), fileName("zadachi"));
  }
}

async function send(workbook: ExcelJS.Workbook, name: string): Promise<Response> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

function fileName(prefix: string): string {
  return `tasktracker-${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
