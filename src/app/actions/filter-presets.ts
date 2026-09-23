"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  type FilterScope,
  PRESET_LIMIT,
  cleanPresetName,
  isFilterScope,
  presetQuery,
  scopeHref,
} from "@/lib/filter-presets";

export type PresetResult = { ok: boolean; message: string };

/**
 * Наборы фильтров: сохранение, переименование, удаление и выбор набора по
 * умолчанию. Набор личный, поэтому каждое действие проверяет, что набор
 * принадлежит тому, кто его правит.
 */
export async function savePreset(
  scope: string,
  name: string,
  query: string,
): Promise<PresetResult> {
  const user = await requireUser();
  if (!isFilterScope(scope)) return { ok: false, message: "Неизвестный реестр" };

  const title = cleanPresetName(name);
  if (!title) return { ok: false, message: "Дайте набору имя" };

  const existing = await prisma.filterPreset.findUnique({
    where: { memberId_scope_name: { memberId: user.id, scope, name: title } },
    select: { id: true },
  });

  if (!existing) {
    const count = await prisma.filterPreset.count({ where: { memberId: user.id, scope } });
    if (count >= PRESET_LIMIT) {
      return { ok: false, message: `Наборов уже ${PRESET_LIMIT}: удалите ненужный` };
    }
  }

  await prisma.filterPreset.upsert({
    where: { memberId_scope_name: { memberId: user.id, scope, name: title } },
    create: { memberId: user.id, scope, name: title, query: presetQuery(query) },
    update: { query: presetQuery(query) },
  });

  revalidatePath(scopeHref(scope));
  return {
    ok: true,
    message: existing ? `Набор «${title}» обновлён` : `Набор «${title}» сохранён`,
  };
}

export async function renamePreset(id: string, name: string): Promise<PresetResult> {
  const preset = await own(id);
  if (!preset) return { ok: false, message: "Набор не найден" };

  const title = cleanPresetName(name);
  if (!title) return { ok: false, message: "Дайте набору имя" };
  if (title === preset.name) return { ok: true, message: "" };

  const taken = await prisma.filterPreset.findUnique({
    where: {
      memberId_scope_name: { memberId: preset.memberId, scope: preset.scope, name: title },
    },
    select: { id: true },
  });
  if (taken) return { ok: false, message: `Набор «${title}» уже есть` };

  await prisma.filterPreset.update({ where: { id }, data: { name: title } });
  revalidatePath(scopeHref(preset.scope as FilterScope));
  return { ok: true, message: `Теперь это «${title}»` };
}

export async function deletePreset(id: string): Promise<PresetResult> {
  const preset = await own(id);
  if (!preset) return { ok: false, message: "Набор не найден" };

  await prisma.filterPreset.delete({ where: { id } });
  revalidatePath(scopeHref(preset.scope as FilterScope));
  return { ok: true, message: `Набор «${preset.name}» удалён` };
}

/**
 * Набор по умолчанию один на реестр: включая новый, снимаем прежний, иначе
 * при открытии непонятно, какой из них применится.
 */
export async function toggleDefaultPreset(id: string): Promise<PresetResult> {
  const preset = await own(id);
  if (!preset) return { ok: false, message: "Набор не найден" };

  const next = !preset.isDefault;
  if (next) {
    await prisma.filterPreset.updateMany({
      where: { memberId: preset.memberId, scope: preset.scope, isDefault: true },
      data: { isDefault: false },
    });
  }
  await prisma.filterPreset.update({ where: { id }, data: { isDefault: next } });

  revalidatePath(scopeHref(preset.scope as FilterScope));
  return {
    ok: true,
    message: next
      ? `«${preset.name}» применяется при открытии`
      : `«${preset.name}» больше не применяется при открытии`,
  };
}

/** Чужой набор не правится и не удаляется даже по прямому вызову. */
async function own(id: string) {
  const user = await requireUser();
  const preset = await prisma.filterPreset.findUnique({
    where: { id },
    select: { id: true, memberId: true, scope: true, name: true, isDefault: true },
  });
  return preset && preset.memberId === user.id ? preset : null;
}
