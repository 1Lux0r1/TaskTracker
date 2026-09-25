import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { KanbanBoard } from "@/components/kanban-board";
import { TaskTimeline } from "@/components/task-timeline";
import { TaskList } from "@/components/task-list";
import { BulkVisibility } from "@/components/bulk-visibility";
import { prisma } from "@/lib/db";
import { TASK_STATUS_LABELS, TASK_STATUSES, startOfToday } from "@/lib/domain";
import {
  TASK_PRESETS,
  TASK_SORTS,
  buildTaskOrderBy,
  buildTaskWhere,
  countActiveTaskFilters,
  readTaskFilter,
} from "@/lib/task-filters";
import { requireUser } from "@/lib/auth";
import { FilterPresets } from "@/components/filter-presets";
import { presetContext } from "@/lib/filter-presets-db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TasksPage(props: PageProps<"/tasks">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const presets = await presetContext(user.id, "TASK", params);
  if (presets.redirectTo) redirect(presets.redirectTo);
  const filter = readTaskFilter(params);
  const today = startOfToday();
  const activeFilters = countActiveTaskFilters(filter);

  const [tasks, projects, members, trackRows] = await Promise.all([
    prisma.task.findMany({
      where: buildTaskWhere(filter, today),
      include: {
        assignee: true,
        project: true,
        track: true,
        _count: { select: { attachments: true } },
      },
      orderBy: buildTaskOrderBy(filter.sort),
      take: 300,
    }),
    prisma.project.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.track.findMany({
      where: { isArchived: false, ...(filter.projectId ? { projectId: filter.projectId } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true },
    }),
  ]);

  // Треки свои у каждого проекта: «Юридический» в двух проектах —
  // для пользователя один трек, поэтому названия схлопываем.
  const trackNames = [...new Set(trackRows.map((row) => row.name))];

  const cancelled = tasks.filter((task) => task.status === "CANCELLED").length;

  // По макету задачи открываются доской; список — второй вид того же набора.
  const view: View = VIEWS.some((item) => item.value === params.view)
    ? (params.view as View)
    : "board";
  const viewHref = (next: View) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "view" || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
      else query.set(key, value);
    }
    query.set("view", next);
    return `/tasks?${query.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-[25px] leading-tight font-bold text-gray-900">Задачи</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
            Все треки в одном месте: задачи разработки видны здесь ссылкой на внешний трекер,
            остальные ведутся тут.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="seg" aria-label="Вид">
            {VIEWS.map((item) => (
              <Link
                key={item.value}
                href={viewHref(item.value)}
                aria-current={view === item.value ? "page" : undefined}
                className="seg-btn"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/api/export" className="btn-secondary">
            Выгрузить
          </Link>
          <Link href="/tasks/new" className="btn-primary">
            Новая задача
          </Link>
        </div>
      </div>

      <FilterBar
        resetHref={presets.resetHref}
        activeCount={activeFilters}
        applied={presets.applied}
        presets={
          <FilterPresets scope="TASK" items={presets.items} appliedId={presets.appliedId ?? undefined} />
        }
        query={filter.query}
        placeholder="Поиск по названию, номеру, ходу работы"
        found={
          <>
            Найдено: {tasks.length}
            {tasks.length === 300 && " (первые 300, уточните фильтр)"}
          </>
        }
      >
        <label className="field">
          Выборка
          <select name="preset" defaultValue={filter.preset} className="input">
            {TASK_PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Проект
          <select name="projectId" defaultValue={filter.projectId} className="input">
            <option value="">Все проекты</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ответственный
          <select name="assigneeId" defaultValue={filter.assigneeId} className="input">
            <option value="">Все</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Трек
          <select name="track" defaultValue={filter.track} className="input">
            <option value="">Все треки</option>
            {trackNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Статус
          <select name="status" defaultValue={filter.status} className="input">
            <option value="">Любой</option>
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TASK_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Порядок
          <select name="sort" defaultValue={filter.sort} className="input">
            {TASK_SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>

      {view === "timeline" ? (
        <TaskTimeline tasks={tasks} today={today} />
      ) : view === "board" ? (
        <>
          <KanbanBoard tasks={tasks} />
          {/* На доске нет колонки «Отменена»: такие задачи видны в списке. */}
          {cancelled > 0 && (
            <p className="text-sm text-gray-500">
              Отменённых задач под фильтром: {cancelled}. Их видно{" "}
              <Link href={viewHref("list")} className="font-medium text-brand hover:underline">
                списком
              </Link>
              .
            </p>
          )}
        </>
      ) : user.role === "ADMIN" ? (
        <BulkVisibility entity="TASK">
          <TaskList
            tasks={tasks}
            showProject
            selectable
            emptyMessage="Под фильтр ничего не подошло."
          />
        </BulkVisibility>
      ) : (
        <TaskList tasks={tasks} showProject emptyMessage="Под фильтр ничего не подошло." />
      )}
    </div>
  );
}

/** Три вида одного набора задач, как в макете: доска, список и сроки. */
const VIEWS = [
  { value: "board", label: "Доска" },
  { value: "list", label: "Список" },
  { value: "timeline", label: "Сроки" },
] as const;

type View = (typeof VIEWS)[number]["value"];
