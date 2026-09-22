import Link from "next/link";
import { DirectionBadge, LetterStatusBadge } from "@/components/letter-badges";
import { prisma } from "@/lib/db";
import {
  LETTER_DIRECTION_LABELS,
  LETTER_DIRECTIONS,
  LETTER_STATUS_LABELS,
  LETTER_STATUSES,
  formatDate,
  isLetterOpen,
  startOfToday,
} from "@/lib/domain";
import {
  LETTER_PRESETS,
  LETTER_SORTS,
  buildLetterOrderBy,
  buildLetterWhere,
  countActiveFilters,
  readLetterFilter,
} from "@/lib/letter-filters";

export const dynamic = "force-dynamic";

export default async function LettersPage(props: PageProps<"/letters">) {
  const params = await props.searchParams;
  const filter = readLetterFilter(params);
  const today = startOfToday();
  const activeFilters = countActiveFilters(filter);

  const [letters, counterparties, members] = await Promise.all([
    prisma.letter.findMany({
      where: buildLetterWhere(filter, today),
      include: { counterparty: true, owner: true, project: true },
      orderBy: buildLetterOrderBy(filter.sort),
      take: 300,
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.member.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Переписка ЭДО</h1>
          <p className="text-sm text-gray-500">
            Входящие и исходящие письма со сроками исполнения
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/api/export?entity=letters" className="btn-secondary">
            Выгрузить в Excel
          </Link>
          <Link href="/letters/new" className="btn-primary">
            Внести письмо
          </Link>
        </div>
      </div>

      <form className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="field">
            Выборка
            <select name="preset" defaultValue={filter.preset} className="input w-52">
              {LETTER_PRESETS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Поиск
            <input
              name="q"
              defaultValue={filter.query}
              placeholder="номер, тема, организация"
              className="input w-72"
            />
          </label>
          <label className="field">
            Организация
            <select
              name="counterpartyId"
              defaultValue={filter.counterpartyId}
              className="input w-56"
            >
              <option value="">Все</option>
              {counterparties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Ответственный
            <select name="ownerId" defaultValue={filter.ownerId} className="input w-52">
              <option value="">Любой</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="field">
            Направление
            <select name="direction" defaultValue={filter.direction} className="input w-40">
              <option value="">Любое</option>
              {LETTER_DIRECTIONS.map((value) => (
                <option key={value} value={value}>
                  {LETTER_DIRECTION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Статус
            <select name="status" defaultValue={filter.status} className="input w-48">
              <option value="">Любой</option>
              {LETTER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {LETTER_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Дата письма с
            <input type="date" name="from" defaultValue={filter.from} className="input w-44" />
          </label>
          <label className="field">
            по
            <input type="date" name="to" defaultValue={filter.to} className="input w-44" />
          </label>
          <label className="field">
            Порядок
            <select name="sort" defaultValue={filter.sort} className="input w-48">
              {LETTER_SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-secondary">
            Показать
          </button>
          {activeFilters > 0 && (
            <Link href="/letters" className="pb-2 text-sm text-gray-500 hover:underline">
              Сбросить фильтры ({activeFilters})
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-gray-500">
        Найдено писем: {letters.length}
        {letters.length === 300 && " (показаны первые 300, уточните фильтр)"}
      </p>

      {letters.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Под фильтр ничего не подошло.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-5xl border-collapse">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-head w-40">Номер</th>
                <th className="table-head w-28">Дата</th>
                <th className="table-head w-32">Направление</th>
                <th className="table-head">Тема</th>
                <th className="table-head w-48">Организация</th>
                <th className="table-head w-28">Срок</th>
                <th className="table-head w-40">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {letters.map((letter) => {
                const overdue =
                  letter.dueDate !== null && isLetterOpen(letter.status) && letter.dueDate < today;
                return (
                  <tr key={letter.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <Link
                        href={`/letters/${letter.id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {letter.number}
                      </Link>
                    </td>
                    <td className="table-cell tabular-nums">{formatDate(letter.date)}</td>
                    <td className="table-cell">
                      <DirectionBadge direction={letter.direction} />
                    </td>
                    <td className="table-cell">
                      <span className="line-clamp-2">{letter.subject}</span>
                      {letter.url && (
                        <a
                          href={letter.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 block text-xs text-blue-600 hover:underline"
                        >
                          карточка в ЭДО
                        </a>
                      )}
                    </td>
                    <td className="table-cell">{letter.counterparty?.name ?? "—"}</td>
                    <td
                      className={`table-cell tabular-nums ${overdue ? "font-medium text-red-600" : ""}`}
                    >
                      {formatDate(letter.dueDate)}
                    </td>
                    <td className="table-cell">
                      <LetterStatusBadge status={letter.status} />
                      {letter.statusNote && (
                        <p className="mt-0.5 text-xs text-gray-500">{letter.statusNote}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
