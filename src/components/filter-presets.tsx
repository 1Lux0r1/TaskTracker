"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  type PresetResult,
  deletePreset,
  renamePreset,
  savePreset,
  toggleDefaultPreset,
} from "@/app/actions/filter-presets";
import { PRESET_NAME_LIMIT, type FilterScope } from "@/lib/filter-presets";

type Item = { id: string; name: string; query: string; isDefault: boolean; href: string };

type Props = {
  scope: FilterScope;
  items: Item[];
  /** Id применённого набора: строка списка подсвечивается. */
  appliedId?: string;
};

/**
 * Наборы фильтров живут внутри панели «Фильтры»: на самом реестре по
 * договорённости с заказчиком только строка поиска и одна кнопка. Формы
 * здесь нет — панель сама лежит внутри формы отбора, поэтому кнопки зовут
 * серверные действия напрямую.
 */
export function FilterPresets({ scope, items, appliedId }: Props) {
  const params = useSearchParams();
  const anchor = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  /**
   * Условия берём прямо из полей панели, а не из адреса: человек мог выбрать
   * статус и сразу назвать набор, не нажимая «Показать». В набор должно
   * уйти то, что он видит на экране.
   */
  function currentQuery(): string {
    const form = anchor.current?.closest("form");
    if (!form) return params.toString();

    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === "string") query.append(key, value);
    }
    return query.toString();
  }

  function save() {
    if (name.trim() === "" || pending) return;
    run(async () => {
      const result = await savePreset(scope, name, currentQuery());
      if (result.ok) setName("");
      return result;
    });
  }

  // Строка переименования при ошибке не закрывается: имя набрано, и терять
  // его из-за занятого имени незачем.
  function run(action: () => Promise<PresetResult>) {
    start(async () => {
      const result = await action();
      setNote(result.message);
      if (result.ok) setRenaming(null);
      setRemoving(null);
    });
  }

  return (
    <div ref={anchor} className="space-y-2 rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Мои наборы</p>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">
          Наборов пока нет. Задайте условия, назовите их — и реестр будет открываться так же.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5 ${
                item.id === appliedId ? "bg-white ring-1 ring-gray-300" : ""
              }`}
            >
              {renaming === item.id ? (
                <RenameRow
                  name={item.name}
                  pending={pending}
                  onCancel={() => setRenaming(null)}
                  onSave={(value) => run(() => renamePreset(item.id, value))}
                />
              ) : removing === item.id ? (
                <>
                  <span className="text-sm font-medium text-gray-900">
                    Удалить набор «{item.name}»?
                  </span>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={pending}
                    onClick={() => run(() => deletePreset(item.id))}
                  >
                    Да, удалить
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRemoving(null)}
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={item.href}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 hover:underline"
                  >
                    {item.name}
                  </Link>

                  {item.isDefault && (
                    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                      при открытии
                    </span>
                  )}

                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:underline"
                    disabled={pending}
                    onClick={() => run(() => toggleDefaultPreset(item.id))}
                  >
                    {item.isDefault ? "Не применять при открытии" : "Применять при открытии"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:underline"
                    onClick={() => setRenaming(item.id)}
                  >
                    Переименовать
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setRemoving(item.id)}
                  >
                    Удалить
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-2">
        {/* Поле без name: оно лежит внутри формы отбора и не должно уезжать
            в адрес вместе с фильтрами. */}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (isEnter(event)) save();
          }}
          maxLength={PRESET_NAME_LIMIT}
          placeholder="Имя набора: «Мои просроченные»"
          aria-label="Имя набора"
          className="input w-full min-w-0 sm:w-64"
        />
        <button type="button" className="btn-secondary" disabled={pending || name.trim() === ""} onClick={save}>
          Сохранить нынешние условия
        </button>
        {note && <span className="text-sm text-gray-600">{note}</span>}
      </div>
    </div>
  );
}

function RenameRow({
  name,
  pending,
  onCancel,
  onSave,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(name);

  return (
    <>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (isEnter(event) && value.trim() !== "" && !pending) onSave(value);
        }}
        maxLength={PRESET_NAME_LIMIT}
        aria-label="Новое имя набора"
        className="input w-full min-w-0 sm:w-64"
        autoFocus
      />
      <button
        type="button"
        className="btn-secondary"
        disabled={pending || value.trim() === ""}
        onClick={() => onSave(value)}
      >
        Сохранить
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel}>
        Отмена
      </button>
    </>
  );
}

/**
 * Enter в поле имени: поле лежит внутри формы отбора, и без перехвата браузер
 * отправил бы её — страница перезагрузилась бы, а набор не сохранился.
 */
function isEnter(event: React.KeyboardEvent<HTMLInputElement>): boolean {
  if (event.key !== "Enter") return false;
  event.preventDefault();
  return true;
}
