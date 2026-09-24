import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { VisibilityBadge } from "@/components/badges";
import { BulkVisibility } from "@/components/bulk-visibility";
import { LetterStatusBadge } from "@/components/letter-badges";
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
import { requireUser } from "@/lib/auth";
import { FilterPresets } from "@/components/filter-presets";
import { presetContext } from "@/lib/filter-presets-db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LettersPage(props: PageProps<"/letters">) {
  const user = await requireUser();
  const params = await props.searchParams;
  const presets = await presetContext(user.id, "LETTER", params);
  if (presets.redirectTo) redirect(presets.redirectTo);
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
          <h1 className="text-2xl font-semibold text-gray-900">Реестр писем ЭДО</h1>
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

      <FilterBar
        resetHref={presets.resetHref}
        activeCount={activeFilters}
        applied={presets.applied}
        presets={
          <FilterPresets scope="LETTER" items={presets.items} appliedId={presets.appliedId ?? undefined} />
        }
        query={filter.query}
        placeholder="номер, тема, организация"
      >
        <label className="field">
          Выборка
          <select name="preset" defaultValue={filter.preset} className="input">
            {LETTER_PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Организация
          <select name="counterpartyId" defaultValue={filter.counterpartyId} className="input">
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
          <select name="ownerId" defaultValue={filter.ownerId} className="input">
            <option value="">Любой</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Направление
          <select name="direction" defaultValue={filter.direction} className="input">
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
          <select name="status" defaultValue={filter.status} className="input">
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
          <input type="date" name="from" defaultValue={filter.from} className="input" />
        </label>
        <label className="field">
          по
          <input type="date" name="to" defaultValue={filter.to} className="input" />
        </label>
        <label className="field">
          Порядок
          <select name="sort" defaultValue={filter.sort} className="input">
            {LETTER_SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>

      <p className="text-sm text-gray-500">
        Найдено писем: {letters.length}
        {letters.length === 300 && " (показаны первые 300, уточните фильтр)"}
      </p>

      {letters.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Под фильтр ничего не подошло.</p>
      ) : (
        <BulkVisibility entity="LETTER" enabled={user.role === "ADMIN"}>
          {/*
            Реестр строками, как в макете: значок направления, номер с датой,
            тема, контрагент, срок и статус. Таблицы с шапкой здесь нет —
            на узком экране строка просто складывается в две колонки.
          */}
          <ul className="card divide-y divide-gray-200 overflow-hidden">
            {letters.map((letter) => {
              const overdue =
                letter.dueDate !== null && isLetterOpen(letter.status) && letter.dueDate < today;
              const incoming = letter.direction === "INCOMING";
              return (
                <li
                  key={letter.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-gray-50"
                >
                  {user.role === "ADMIN" && (
                    <input
                      type="checkbox"
                      name="ids"
                      value={letter.id}
                      className="size-4 flex-none"
                      aria-label={`Отметить письмо № ${letter.number}`}
                    />
                  )}

                  <span
                    aria-hidden
                    className={`grid h-[22px] w-7 flex-none place-items-center rounded-md text-xs font-semibold ${
                      incoming ? "bg-blue-50 text-brand" : "bg-orange-50 text-copper"
                    }`}
                  >
                    {incoming ? "Вх" : "Исх"}
                  </span>

                  <span className="w-36 flex-none font-mono text-[13px] text-gray-600 tabular-nums">
                    <Link href={`/letters/${letter.id}`} className="hover:underline">
                      {letter.number}
                    </Link>
                    <span className="block text-[11.5px] text-gray-500">
                      {formatDate(letter.date)}
                    </span>
                  </span>

                  <span className="min-w-52 flex-1">
                    <Link
                      href={`/letters/${letter.id}`}
                      className="block text-[14.5px] text-gray-900 hover:underline"
                    >
                      {letter.subject}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                      <span>{letter.counterparty?.name ?? "организация не указана"}</span>
                      <VisibilityBadge isPublic={letter.isPublic} />
                      {letter.url && (
                        <a
                          href={letter.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          карточка в ЭДО
                        </a>
                      )}
                    </span>
                  </span>

                  <span className="flex w-40 flex-none flex-col items-start gap-0.5">
                    <LetterStatusBadge status={letter.status} />
                    {letter.statusNote && (
                      <span className="text-xs text-gray-500">{letter.statusNote}</span>
                    )}
                  </span>

                  <span
                    className={`w-24 flex-none text-right font-mono text-[13px] tabular-nums ${
                      overdue ? "font-medium text-red-600" : "text-gray-500"
                    }`}
                  >
                    {formatDate(letter.dueDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        </BulkVisibility>
      )}
    </div>
  );
}
