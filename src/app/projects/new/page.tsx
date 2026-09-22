import Link from "next/link";
import { createProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requireUser();
  const members = await prisma.member.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/projects" className="text-sm text-gray-500 hover:underline">
          ← Проекты
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новый проект</h1>
      </div>
      <ProjectForm action={createProject} members={members} submitLabel="Создать проект" />
    </div>
  );
}
