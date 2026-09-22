"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { type ActionResult, formatZodError, projectInputSchema } from "@/lib/validation";

export async function createProject(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = projectInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const input = parsed.data;
  const duplicate = await prisma.project.findUnique({ where: { code: input.code } });
  if (duplicate) return { ok: false, error: `Проект с кодом ${input.code} уже существует` };

  const project = await prisma.project.create({ data: input });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(
  projectId: string,
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const parsed = projectInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };

  const duplicate = await prisma.project.findUnique({ where: { code: parsed.data.code } });
  if (duplicate && duplicate.id !== projectId) {
    return { ok: false, error: `Проект с кодом ${parsed.data.code} уже существует` };
  }

  await prisma.project.update({ where: { id: projectId }, data: parsed.data });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { ok: true, message: "Проект сохранён" };
}

export async function deleteProject(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  redirect("/projects");
}
