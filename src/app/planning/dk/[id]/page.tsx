import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePlanDk, updatePlanDk } from "@/app/actions/planning";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/planning/action-form";
import { DkFields } from "@/components/planning/dk-fields";
import { TaskLine } from "@/components/planning/task-line";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { formatDate, plural } from "@/lib/domain";
import { dkCipher, param, sortTasks } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

export default async function DkPage(props: PageProps<"/planning/dk/[id]">) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const dk = await prisma.planDk.findUnique({
    where: { id },
    include: {
      subsystem: true,
      part: { include: { direction: { include: { system: true } } } },
      tasks: { include: { stage: true, module: true } },
    },
  });
  if (!dk) notFound();

  const subsystems = await prisma.planSubsystem.findMany({
    where: { systemId: dk.part.direction.systemId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  const tasks = sortTasks(dk.tasks);
  const dkTasks = tasks.filter((task) => !task.module);
  const byModule = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.module) continue;
    const key = `${String(task.module.number).padStart(2, "0")} · ${task.module.name}`;
    byModule.set(key, [...(byModule.get(key) ?? []), task]);
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3.5">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-start gap-3 px-4.5 pt-4.5 pb-3">
            <div className="min-w-0 flex-1">
              <Link href="/planning/roadmap" className="text-sm text-gray-500 hover:underline">
                ← Дорожная карта
              </Link>
              <p className="mt-1 font-mono text-sm text-brand">{dkCipher(dk.part.direction, dk.part, dk)}</p>
              <h2 className="font-display text-xl font-semibold text-gray-900">{dk.name}</h2>
              <p className="text-[13px] text-gray-500">
                {dk.part.direction.name} · {dk.part.name} · {tasks.length}{" "}
                {plural(tasks.length, "задача", "задачи", "задач")} · ОФТ{" "}
                {dk.part.direction.oftApprovedAt
                  ? `согласован ${formatDate(dk.part.direction.oftApprovedAt)}`
                  : "не согласован"}
              </p>
            </div>
            <Link href={`/planning/tasks/new?dk=${dk.id}`} className="btn-primary flex-none">
              Новая задача
            </Link>
          </div>

          <Group title="По ДК: БА и Арх" tasks={dkTasks} empty="Задач по ДК пока нет." />
          {[...byModule].map(([title, items]) => (
            <Group key={title} title={`МС ${title}`} tasks={items} />
          ))}
        </section>
      </div>

      <aside className="space-y-3.5">
        <ActionForm action={updatePlanDk} className="card p-4.5">
          <input type="hidden" name="id" value={dk.id} />
          <h3 className="font-display mb-3 text-[15px] font-semibold text-gray-900">Карточка ДК</h3>
          <DkFields defaults={dk} subsystems={subsystems} />
          <div className="mt-4">
            <SubmitButton>Сохранить</SubmitButton>
          </div>
        </ActionForm>
        <section className="card p-4.5">
          {param(search, "error") === "tasks" && (
            <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              У ДК есть задачи плана: сначала удалите их.
            </p>
          )}
          <p className="mb-3 text-[13px] text-gray-500">Удалить можно ДК без задач.</p>
          <form action={deletePlanDk}>
            <input type="hidden" name="id" value={dk.id} />
            <ConfirmSubmit question="Удалить ДК?">Удалить ДК</ConfirmSubmit>
          </form>
        </section>
      </aside>
    </div>
  );
}

function Group({
  title,
  tasks,
  empty,
}: {
  title: string;
  tasks: React.ComponentProps<typeof TaskLine>["task"][];
  empty?: string;
}) {
  if (tasks.length === 0 && !empty) return null;
  return (
    <div className="border-t border-gray-200">
      <p className="bg-gray-50 px-4 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-gray-500 uppercase">
        {title}
      </p>
      {tasks.length === 0 ? (
        <p className="px-4 py-2.5 text-sm text-gray-500">{empty}</p>
      ) : (
        tasks.map((task) => <TaskLine key={task.id} task={task} />)
      )}
    </div>
  );
}
