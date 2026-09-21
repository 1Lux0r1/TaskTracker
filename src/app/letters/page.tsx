import Link from "next/link";
import { DirectionBadge, LetterStatusBadge } from "@/components/letter-badges";
import { prisma } from "@/lib/db";
import {
  CLOSED_LETTER_STATUSES,
  LETTER_DIRECTION_LABELS,
  LETTER_DIRECTIONS,
  LETTER_STATUS_LABELS,
  LETTER_STATUSES,
  formatDate,
  isLetterOpen,
  startOfToday,
  type LetterDirection,
  type LetterStatus,
} from "@/lib/domain";
import { normalizeQuery } from "@/lib/search";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PRESETS = [
  { value: "open", label: "В работе" },
  { value: "overdue", label: "Просроченные" },
  { value: "due7", label: "Срок в ближайшую неделю" },
  { value: "noOwner", label: "Без ответственного" },
  { value: "noDue", label: "Без срока" },
  { value: "all", label: "Все" },
] as const;

export default async function LettersPage(props: PageProps<"/letters">) {
  const params = await props.searchParams;
  const preset = single(params.preset) ?? "open";
  const direction = single(params.direction) ?? "";
  const status = single(params.status) ?? "";
  const counterpartyId = single(params.counterpartyId) ?? "";
  const query = single(params.q)?.trim() ?? "";

  const today = startOfToday();
  const where: Prisma.LetterWhereInput = {};

  if (preset === "open") where.status = { notIn: CLOSED_LETTER_STATUSES };
  if (preset === "overdue") {
    where.status = { notIn: CLOSED_LETTER_STATUSES };
    where.dueDate = { lt: today };
  }
  if (preset === "due7") {
    where.status = { notIn: CLOSED_LETTER_STATUSES };
    where.dueDate = { gte: today, lte: new Date(today.getTime() + 7 * 86_400_000) };
  }
  if (preset === "noOwner") {
    where.status = { notIn: CLOSED_LETTER_STATUSES };
    where.ownerId = null;
  }
  if (preset === "noDue") {
    where.status = { notIn: CLOSED_LETTER_STATUSES };
    where.dueDate = null;
  }
  if (direction && LETTER_DIRECTIONS.includes(direction as LetterDirection)) {
    where.direction = direction;
  }
  if (status && LETTER_STATUSES.includes(status as LetterStatus)) where.status = status;
  if (counterpartyId) where.counterpartyId = counterpartyId;
  if (query) {
    // Каждое слово должно встретиться: так «россети регламент» сужает выборку,
    // а не выдаёт всё, где есть хотя бы одно из слов.
    const terms = normalizeQuery(query).split(" ").filter(Boolean).slice(0, 6);
    where.AND = terms.map((term) => ({
      OR: [{ searchIndex: { contains: term } }, { number: { contains: term } }],
    }));
  }

  const [letters, counterparties] = await Promise.all([
    prisma.letter.findMany({
      where,
      include: { counterparty: true, owner: true, project: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.counterparty.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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
            Новое письмо
          </Link>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="field">
          Выборка
          <select name="preset" defaultValue={preset} className="input w-44">
            {PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Направление
          <select name="direction" defaultValue={direction} className="input w-40">
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
          <select name="status" defaultValue={status} className="input w-48">
            <option value="">Любой</option>
            {LETTER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {LETTER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Контрагент
          <select name="counterpartyId" defaultValue={counterpartyId} className="input w-56">
            <option value="">Все</option>
            {counterparties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Поиск
          <input
            name="q"
            defaultValue={query}
            placeholder="номер, тема, контрагент"
            className="input w-64"
          />
        </label>
        <button type="submit" className="btn-secondary">
          Показать
        </button>
      </form>

      <p className="text-sm text-gray-500">Найдено писем: {letters.length}</p>

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
                <th className="table-head w-48">Контрагент</th>
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

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
