import Link from "next/link";
import { notFound } from "next/navigation";
import { KanbanBoard } from "@/components/kanban-board";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProjectBoardPage(props: PageProps<"/projects/[id]/board">) {
  await requireUser();
  const { id } = await props.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tasks: {
        include: { assignee: true },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/projects/${project.id}`} className="text-sm text-gray-500 hover:underline">
            ← {project.name}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Канбан-доска</h1>
        </div>
        <Link href={`/tasks/new?projectId=${project.id}`} className="btn-primary">
          Новая задача
        </Link>
      </div>

      <KanbanBoard tasks={project.tasks} />
    </div>
  );
}
