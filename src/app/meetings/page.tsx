import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { prisma } from "@/lib/db";
import {
  MEETING_KIND_LABELS,
  MEETING_KINDS,
  formatDate,
  formatMeetingTime,
  isUpcomingMeeting,
  meetingKindLabel,
  plural,
  startOfToday,
} from "@/lib/domain";
import { Block, Pill } from "@/components/ui";
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
      take: 300,
    }),
    prisma.project.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const upcoming = meetings
    .filter((meeting) => isUpcomingMeeting(meeting.date, today))
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
  const past = meetings.filter((meeting) => !isUpcomingMeeting(meeting.date, today));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-[25px] leading-tight font-bold text-gray-900">Встречи</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
            Повестка, участники и решения хранятся вместе со встречей, а не в переписке. Из
            решения сразу заводится задача.
          </p>
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
        placeholder="Поиск по теме, месту, повестке"
        found={`Встреч: ${meetings.length}`}
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

      {meetings.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">
          {activeFilters === 0 ? "Встреч пока нет." : "Под фильтр ничего не подошло."}
        </p>
      ) : (
        // Две карточки, как в макете: ближайшие — от ближайшей, прошедшие —
        // от последней, у каждой видно, внесены ли материалы и решения.
        <div className="grid items-start gap-3.5 lg:grid-cols-2">
          <Block
            tone="brand"
            icon="calendar"
            title="Ближайшие"
            sub={
              upcoming.length > 0
                ? `${upcoming.length} ${plural(upcoming.length, "встреча", "встречи", "встреч")} впереди`
                : "Впереди встреч нет"
            }
            flush
          >
            <MeetingRows meetings={upcoming} upcoming empty="Предстоящих встреч нет." />
          </Block>
          <Block tone="violet" icon="clock" title="Прошедшие" sub="Материалы и решения" flush>
            <MeetingRows meetings={past} upcoming={false} empty="Прошедших встреч нет." />
          </Block>
        </div>
      )}

      <Block tone="copper" icon="mail" title="Почта" sub="Что появится, когда подключим почтовый ящик проекта">
        <ul className="list-disc space-y-1 pl-5 text-[14.5px] text-gray-600">
          <li>Приглашение из календаря почты создаёт встречу с участниками и временем.</li>
          <li>Протокол рассылается участникам одной кнопкой, отправка пишется в историю встречи.</li>
          <li>Письма по теме встречи подтягиваются в её материалы ссылкой на реестр писем ЭДО.</li>
        </ul>
      </Block>
    </div>
  );
}

type MeetingRow = {
  id: string;
  subject: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  place: string | null;
  kind: string;
  decisions: string | null;
  participants: {
    externalName: string | null;
    member: { fullName: string } | null;
    orgContact: { fullName: string } | null;
  }[];
  _count: { attachments: number; tasks: number };
};

function MeetingRows({
  meetings,
  upcoming,
  empty,
}: {
  meetings: MeetingRow[];
  upcoming: boolean;
  empty: string;
}) {
  if (meetings.length === 0) {
    return <p className="px-[18px] pb-[18px] text-sm text-gray-500">{empty}</p>;
  }
  return (
    <ul className="border-t border-gray-200">
      {meetings.map((meeting) => {
        const names = meeting.participants
          .map((item) => item.member?.fullName ?? item.orgContact?.fullName ?? item.externalName)
          .filter(Boolean);
        const files = meeting._count.attachments;
        return (
          <li key={meeting.id} className="border-b border-gray-200 last:border-b-0">
            <Link
              href={`/meetings/${meeting.id}`}
              className="block px-[18px] py-[13px] hover:bg-brand-soft"
            >
              <span className="block text-[14.5px] leading-snug text-gray-900">{meeting.subject}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-gray-500">
                <span className="font-mono text-gray-600">
                  {formatDate(meeting.date)} {formatMeetingTime(meeting.startTime, meeting.endTime)}
                </span>
                {meeting.place && <span>{meeting.place}</span>}
                {names.length > 0 && <span>{names.join(", ")}</span>}
                {files > 0 && (
                  <span>
                    {files} {plural(files, "файл", "файла", "файлов")}
                  </span>
                )}
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                <Pill>{meetingKindLabel(meeting.kind)}</Pill>
                {upcoming ? (
                  files === 0 && <Pill tone="warn">материалы не внесены</Pill>
                ) : meeting.decisions ? (
                  <Pill tone="good">есть решения</Pill>
                ) : (
                  <Pill tone="bad">решения не записаны</Pill>
                )}
                {meeting._count.tasks > 0 && (
                  <Pill tone="brand">
                    {meeting._count.tasks} {plural(meeting._count.tasks, "задача", "задачи", "задач")}
                  </Pill>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
