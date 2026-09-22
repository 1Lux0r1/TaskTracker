"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { TRACK_COLORS, trackColor } from "@/lib/domain";
import type { ActionResult } from "@/lib/validation";

type Props = {
  track: { id: string; name: string; color: string };
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
};

/** Название и цвет трека правятся прямо в строке списка. */
export function TrackRowForm({ track, action }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);
  // После удачного сохранения строка возвращается к обычному виду: иначе
  // пользователь остаётся в полях ввода и не видит, что получилось. Сравнение
  // с прошлым ответом — чтобы закрыть форму один раз, а не на каждый рендер.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok && open) setOpen(false);
  }
  const color = trackColor(track.color);

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-block h-3 w-3 rounded-full ${color.dot}`} />
        <span className="font-medium text-gray-900">{track.name}</span>
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Изменить
        </button>
        {state?.ok && state.message && (
          <span className="text-xs text-emerald-600">{state.message}</span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="trackId" value={track.id} />
      <input name="name" required maxLength={80} defaultValue={track.name} className="input w-52" />
      <select name="color" defaultValue={track.color} className="input w-40">
        {TRACK_COLORS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <SubmitButton className="btn-primary" pendingLabel="…">
        Сохранить
      </SubmitButton>
      <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
        Отмена
      </button>
      {state && !state.ok && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
