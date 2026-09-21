import { buildImportTemplate, buildTasksWorkbook } from "@/lib/excel/export";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** GET /api/export?projectId=…  или  /api/export?template=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsTemplate = url.searchParams.get("template") === "1";
  const projectId = url.searchParams.get("projectId") ?? undefined;

  const workbook = wantsTemplate ? buildImportTemplate() : await buildTasksWorkbook(projectId);
  const buffer = await workbook.xlsx.writeBuffer();

  const fileName = wantsTemplate
    ? "tasktracker-template.xlsx"
    : `tasktracker-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
