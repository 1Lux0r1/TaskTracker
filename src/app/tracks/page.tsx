import Link from "next/link";
import {
  createTrack,
  deleteTrack,
  moveTrack,
  toggleTrackArchived,
  updateTrack,
} from "@/app/actions/tracks";
import { SubmitButton } from "@/components/submit-button";
import { ProjectSwitch } from "@/components/project-switch";
import { TrackForm } from "@/components/track-form";
import { TrackRowForm } from "@/components/track-row-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProjectTracks } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export const metadata = { title: "Треки работ — TaskTracker" };

export default async function TracksPage(props: PageProps<"/tracks">) {
  await requireUser();
  const params = await props.searchParams;
  const requested = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  if (projects.length === 0) {
    return (
      <p className="card p-6 text-sm text-gray-500">
        Треки заводятся внутри проекта. Сначала создайте проект:{" "}
        <Link href="/projects/new" className="font-medium text-gray-900 hover:underline">
          новый проект
        </Link>
        .
      </p>
    );
  }

  const selected = requested && projects.some((p) => p.id === requested) ? requested : projects[0].id;
  await ensureProjectTracks(selected);

  const tracks = await prisma.track.findMany({
    where: { projectId: selected },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { tasks: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Треки работ</h1>
        <p className="text-sm text-gray-500">
          Свой список направлений работы у каждого проекта. Четыре трека из Excel заведены
          сразу, их можно переименовать, перекрасить и дополнить своими. Цветом трек виден
          в задачах, на доске и в календаре.
        </p>
      </div>

      {projects.length > 1 && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <ProjectSwitch projects={projects} selected={selected} basePath="/tracks" />
        </div>
      )}

      <TrackForm action={createTrack} projectId={selected} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-3xl border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="table-head">Трек</th>
              <th className="table-head w-28">Задач</th>
              <th className="table-head w-36">Порядок</th>
              <th className="table-head w-56">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tracks.map((track) => (
              <tr key={track.id} className={track.isArchived ? "text-gray-400" : ""}>
                <td className="table-cell">
                  <TrackRowForm
                    track={{ id: track.id, name: track.name, color: track.color }}
                    action={updateTrack}
                  />
                  {track.isArchived && (
                    <span className="mt-1 block text-xs text-gray-400">
                      В архиве: в новых задачах не предлагается
                    </span>
                  )}
                </td>
                <td className="table-cell tabular-nums">{track._count.tasks}</td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    <form action={moveTrack}>
                      <input type="hidden" name="trackId" value={track.id} />
                      <input type="hidden" name="direction" value="up" />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        ↑
                      </SubmitButton>
                    </form>
                    <form action={moveTrack}>
                      <input type="hidden" name="trackId" value={track.id} />
                      <input type="hidden" name="direction" value="down" />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        ↓
                      </SubmitButton>
                    </form>
                  </div>
                </td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-2">
                    <form action={toggleTrackArchived}>
                      <input type="hidden" name="trackId" value={track.id} />
                      <SubmitButton className="btn-secondary" pendingLabel="…">
                        {track.isArchived ? "Вернуть" : "В архив"}
                      </SubmitButton>
                    </form>
                    {track._count.tasks === 0 && (
                      <form action={deleteTrack}>
                        <input type="hidden" name="trackId" value={track.id} />
                        <SubmitButton className="btn-secondary" pendingLabel="…">
                          Удалить
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
