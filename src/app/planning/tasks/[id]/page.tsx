import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePlanTask, updatePlanTask } from "@/app/actions/planning";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CipherCalculator } from "@/components/planning/cipher-calculator";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/domain";
import { loadCalculatorData } from "@/lib/planning/queries";

export const dynamic = "force-dynamic";

/** Задача плана: правка через тот же калькулятор, шифр пересчитывается. */
export default async function PlanTaskPage(props: PageProps<"/planning/tasks/[id]">) {
  const { id } = await props.params;
  const task = await prisma.planTask.findUnique({
    where: { id },
    include: { dk: { include: { part: { include: { direction: { include: { system: true } } } } } } },
  });
  if (!task) notFound();

  const data = await loadCalculatorData(task.dk.part.direction.system);
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/planning/dk/${task.dkId}`} className="text-sm text-gray-500 hover:underline">
          ← ДК {String(task.dk.number).padStart(2, "0")} · {task.dk.name}
        </Link>
        <span className="font-mono text-sm font-semibold text-gray-900">{task.cipher}</span>
      </div>
      <CipherCalculator
        data={data}
        defaults={{
          taskId: task.id,
          dkId: task.dkId,
          moduleId: task.moduleId,
          stageId: task.stageId,
          repeat: task.repeat,
          name: task.name,
          start: toDateInputValue(task.startDate),
          weeks: task.durationWeeks ? String(task.durationWeeks) : "",
          finish: toDateInputValue(task.finishDate),
        }}
        action={updatePlanTask}
        submitLabel="Сохранить задачу"
      />
      <form action={deletePlanTask} className="card flex flex-wrap items-center gap-3 p-4">
        <input type="hidden" name="id" value={task.id} />
        <span className="text-[13px] text-gray-500">Удаление задачи освобождает её шифр.</span>
        <ConfirmSubmit question="Удалить задачу?">Удалить задачу</ConfirmSubmit>
      </form>
    </div>
  );
}
