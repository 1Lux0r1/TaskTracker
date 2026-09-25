import Link from "next/link";
import { FilterBar } from "@/components/filter-bar";
import { BulkVisibility } from "@/components/bulk-visibility";
import { DirectionMark, LetterStatusBadge } from "@/components/letter-badges";
import { DueTag } from "@/components/ui";
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

  const admin = user.role === "ADMIN";
  const [letters, counterparties, members, total] = await Promise.all([
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
    prisma.letter.count(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="text-[25px] leading-tight font-bold text-gray-900">Реестр писем ЭДО</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
            Реестр ведётся руками: письмо заводится одной формой, а найти его можно по номеру,
            слову из темы или набору фильтров.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/api/export?entity=letters" className="btn-secondary">
            Выгрузить
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
        found={
          <>
            Найдено: {letters.length} из {total}
            {letters.length === 300 && " (первые 300, уточните фильтр)"}
          </>
        }
        placeholder="Номер, тема, ключевое слово"
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

      {letters.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">Под фильтр ничего не подошло.</p>
      ) : (
        <BulkVisibility entity="LETTER" enabled={admin}>
          {/*
            Реестр колонками с подписями, как в макете: номер с датой,
            направление, тема, контрагент, ответственный, срок и статус.
            Рамок ячеек нет; на узком экране подписи прячутся, а строка
            складывается в две колонки.
          */}
          <div
            className="reg"
            style={
              {
                "--reg-cols": `${admin ? "18px " : ""}112px 44px minmax(0,1fr) 156px 128px 96px 152px`,
              } as React.CSSProperties
            }
          >
            <div className="reg-head">
              {admin && <span />}
              <span>Номер</span>
              <span>Тип</span>
              <span>Тема</span>
              <span>Контрагент</span>
              <span>Ответственный</span>
              <span>Срок</span>
              <span>Статус</span>
            </div>
            {letters.map((letter) => {
              const open = isLetterOpen(letter.status);
              return (
                <div key={letter.id} className="reg-row relative">
                  {admin && (
                    <input
                      type="checkbox"
                      name="ids"
                      value={letter.id}
                      className="relative z-10 size-4"
                      aria-label={`Отметить письмо № ${letter.number}`}
                    />
                  )}
                  <span className="font-mono text-[13px] text-gray-900 tabular-nums">
                    {letter.number}
                    <span className="block text-[11.5px] text-gray-500">
                      {formatDate(letter.date)}
                    </span>
                  </span>
                  <DirectionMark direction={letter.direction} />
                  <span className="min-w-0">
                    <Link
                      href={`/letters/${letter.id}`}
                      className={`block truncate after:absolute after:inset-0 after:content-[''] ${
                        letter.status === "NEW" ? "font-semibold text-gray-900" : "text-gray-900"
                      }`}
                    >
                      {letter.subject}
                    </Link>
                    {(!letter.isPublic || letter.statusNote) && (
                      <span className="block truncate text-xs text-gray-500">
                        {[letter.isPublic ? null : "служебное", letter.statusNote]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="reg-cut">{letter.counterparty?.name ?? "—"}</span>
                  <span className="min-w-0 truncate">
                    {letter.owner ? (
                      <span className="text-gray-900">{letter.owner.fullName}</span>
                    ) : open ? (
                      <span className="text-red-600">не назначен</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </span>
                  <DueTag date={letter.dueDate} closed={!open} />
                  <span>
                    <LetterStatusBadge status={letter.status} />
                  </span>
                </div>
              );
            })}
          </div>
        </BulkVisibility>
      )}
    </div>
  );
}
