import Link from "next/link";
import { createProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { type NewScreenProps } from "@/components/overlay-panel";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function NewProjectScreen({ inPanel }: NewScreenProps) {
  await requireUser();
  const members = await prisma.member.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  return (
    <div className={inPanel ? "space-y-4" : "mx-auto max-w-3xl space-y-4"}>
      {/* В панели заголовок и возврат рисует сама панель. */}
      {!inPanel && (
        <div>
          <Link href="/projects" className="text-sm text-gray-500 hover:underline">
            ← Проекты
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Новый проект</h1>
        </div>
      )}
      <ProjectForm action={createProject} members={members} submitLabel="Создать проект" />
    </div>
  );
}
