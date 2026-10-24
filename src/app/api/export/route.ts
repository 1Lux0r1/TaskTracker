import type ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import {
  buildDocumentsWorkbook,
  buildImportTemplate,
  buildLettersWorkbook,
  buildReportWorkbook,
  buildTasksWorkbook,
} from "@/lib/excel/export";
import { startOfToday } from "@/lib/domain";
import { buildPlanWorkbook } from "@/lib/planning/export";
import { parsePlanPeriod, toMonthValue } from "@/lib/planning/period";
import { planSpan, planView } from "@/lib/planning/plan-view";
import { loadPlanTree, pickSystem } from "@/lib/planning/queries";
import { normalizeQuery } from "@/lib/search";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * GET /api/export?entity=tasks|letters|documents|report&projectId=…&reportId=…
 * Без параметров выгружаются задачи по всем проектам.
 *
 * План работ: entity=plan&system=…&period=…&from=2026-01&to=2026-12&scale=week|month&q=…
 * — те же параметры, что у экрана «План работ».
 */
export async function GET(request: Request) {
  // Выгрузка отдаёт те же данные, что и экраны, поэтому закрыта так же.
  const user = await getCurrentUser();
  if (!user) {
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
    case "plan":
      return planExport(url.searchParams, user.displayName || user.fullName);
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

async function planExport(search: URLSearchParams, author: string): Promise<Response> {
  const params = Object.fromEntries(search.entries());
  const { system } = await pickSystem(params);
  if (!system) return new Response("Система планирования не заведена", { status: 404 });

  const directions = await loadPlanTree(system.id);
  const today = startOfToday();
  const period = parsePlanPeriod(params, today, planSpan(directions));
  const query = params.q?.trim() ?? "";
  const workbook = buildPlanWorkbook({
    system,
    period,
    query,
    blocks: planView(directions, { q: normalizeQuery(query), period }),
    today,
    author,
  });
  const range = `${toMonthValue(period.from)}_${toMonthValue(period.to)}`;
  return send(workbook, `plan-rabot-${system.code}-${range}-${period.scale === "month" ? "mesyacy" : "nedeli"}.xlsx`);
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
