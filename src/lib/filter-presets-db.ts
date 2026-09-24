import { prisma } from "@/lib/db";
import {
  type FilterScope,
  PRESET_PARAM,
  noPresetHref,
  presetHref,
  scopeHref,
  shouldApplyDefault,
} from "@/lib/filter-presets";

/** Набор в том виде, в каком его показывает реестр. */
export type PresetView = {
  id: string;
  name: string;
  query: string;
  isDefault: boolean;
  href: string;
};

export type PresetContext = {
  items: PresetView[];
  /** Куда перейти, чтобы применился набор по умолчанию. */
  redirectTo: string | null;
  /** Применённый набор: реестр подписывает его рядом со строкой поиска. */
  applied: { name: string; resetHref: string } | null;
  /** Его же id: в списке наборов применённый выделен. */
  appliedId: string | null;
  /** Адрес «Сбросить». С набором по умолчанию он отменяет и его. */
  resetHref: string;
};

/**
 * Всё, что реестру нужно знать о наборах: список, применённый набор и куда
 * вести сброс. Собрано в одном месте, чтобы четыре реестра вели себя
 * одинаково.
 */
export async function presetContext(
  memberId: string,
  scope: FilterScope,
  params: Record<string, string | string[] | undefined>,
): Promise<PresetContext> {
  const href = scopeHref(scope);
  const rows = await prisma.filterPreset.findMany({
    where: { memberId, scope },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, query: true, isDefault: true },
  });

  const items: PresetView[] = rows.map((row) => ({
    ...row,
    href: presetHref(href, row.query, row.id),
  }));

  const fallback = items.find((item) => item.isDefault) ?? null;
  const redirectTo = fallback && shouldApplyDefault(params) ? fallback.href : null;

  const appliedId = single(params[PRESET_PARAM]);
  const applied = items.find((item) => item.id === appliedId) ?? null;

  return {
    items,
    redirectTo,
    applied: applied ? { name: applied.name, resetHref: noPresetHref(href) } : null,
    appliedId: applied?.id ?? null,
    // Пока набор по умолчанию есть, обычный сброс на чистый адрес вернул бы
    // его обратно, и человек решил бы, что сброс не работает.
    resetHref: fallback ? noPresetHref(href) : href,
  };
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
