import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProject, updateProject } from "@/app/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditProjectPage(props: PageProps<"/projects/[id]/edit">) {
  const { id } = await props.params;

  const [project, members] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  if (!project) notFound();

  const saveProject = updateProject.bind(null, project.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={`/projects/${project.id}`} className="text-sm text-gray-500 hover:underline">
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Настройки проекта</h1>
      </div>

      <ProjectForm
        action={saveProject}
        members={members}
        defaults={project}
        submitLabel="Сохранить"
      />

      <form action={deleteProject} className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Удалить проект</h2>
        <p className="text-sm text-gray-500">
          Вместе с проектом удалятся все его задачи ({project._count.tasks} шт.) и комментарии.
          Действие необратимо — перед удалением выгрузите данные в Excel.
        </p>
        <input type="hidden" name="projectId" value={project.id} />
        <SubmitButton className="btn-danger" pendingLabel="Удаляем…">
          Удалить проект
        </SubmitButton>
      </form>
    </div>
  );
}
