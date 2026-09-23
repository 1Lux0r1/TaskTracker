import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { prisma } from "@/lib/db";
import {
  MEETING_KIND_LABELS,
  MEETING_KINDS,
  formatDate,
  formatMeetingTime,
  isUpcomingMeeting,
  startOfToday,
} from "@/lib/domain";
import {
  MEETING_PRESETS,
  buildMeetingOrderBy,
  buildMeetingWhere,
  countActiveMeetingFilters,
  readMeetingFilter,
} from "@/lib/meeting-filters";
import { requireUser } from "@/lib/auth";
import { FilterPresets } from "@/components/filter-presets";
import { presetContext } from "@/lib/filter-presets-db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MeetingsPage(props: PageProps<"/meetings">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const presets = await presetContext(user.id, "MEETING", params);
  if (presets.redirectTo) redirect(presets.redirectTo);
  const filter = readMeetingFilter(params);
  const today = startOfToday();
  const activeFilters = countActiveMeetingFilters(filter);

  const [meetings, projects] = await Promise.all([
    prisma.meeting.findMany({
      where: buildMeetingWhere(filter, today),
      include: {
        project: { select: { code: true } },
        owner: { select: { fullName: true } },
        participants: {
          include: {
            member: { select: { fullName: true } },
            orgContact: { select: { fullName: true } },
          },
        },
        _count: { select: { attachments: true, tasks: true } },
      },
      orderBy: buildMeetingOrderBy(filter.preset),
      take: 200,
    }),
    prisma.project.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Встречи</h1>
          <p className="text-sm text-gray-500">Повестка, участники, решения и материалы</p>
        </div>
        <Link href="/meetings/new" className="btn-primary">
          Новая встреча
        </Link>
      </div>

      <FilterBar
        resetHref={presets.resetHref}
        activeCount={activeFilters}
        applied={presets.applied}
        presets={
          <FilterPresets scope="MEETING" items={presets.items} appliedId={presets.appliedId ?? undefined} />
        }
        query={filter.query}
        placeholder="тема, место, повестка, решения"
      >
        <label className="field">
          Выборка
          <select name="preset" defaultValue={filter.preset} className="input">
            {MEETING_PRESETS.map((item) => (
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
          Вид
          <select name="kind" defaultValue={filter.kind} className="input">
            <option value="">Любой</option>
            {MEETING_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {MEETING_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>

      <p className="text-sm text-gray-500">Встреч: {meetings.length}</p>

      {meetings.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          {filter.preset === "upcoming" && activeFilters === 0
            ? "Предстоящих встреч нет."
            : "Под фильтр ничего не подошло."}
        </p>
      ) : (
        <ul className="space-y-2">
          {meetings.map((meeting) => {
            const upcoming = isUpcomingMeeting(meeting.date, today);
            const names = meeting.participants
              .map((item) => item.member?.fullName ?? item.orgContact?.fullName ?? item.externalName)
              .filter(Boolean);
            const time = formatMeetingTime(meeting.startTime, meeting.endTime);

            return (
              <li key={meeting.id}>
                <Link
                  href={`/meetings/${meeting.id}`}
                  className="card block p-4 transition hover:border-gray-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{meeting.subject}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {meeting.project.code}
                        {meeting.place && ` · ${meeting.place}`}
                        {meeting.owner && ` · запись ведёт ${meeting.owner.fullName}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-violet-50 text-violet-700">
                        {MEETING_KIND_LABELS[meeting.kind as keyof typeof MEETING_KIND_LABELS] ??
                          meeting.kind}
                      </span>
                      <span
                        className={`badge ${
                          upcoming ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {formatDate(meeting.date)}
                        {time && ` · ${time}`}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-1 text-sm text-gray-600">
                    {names.length > 0 ? `Участники: ${names.join(", ")}` : "Участники не отмечены"}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {meeting.decisions
                      ? "Решения записаны"
                      : upcoming
                        ? "Решений пока нет"
                        : "Решения не записаны"}
                    {meeting._count.tasks > 0 && ` · задач по встрече: ${meeting._count.tasks}`}
                    {meeting._count.attachments > 0 &&
                      ` · материалов: ${meeting._count.attachments}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
