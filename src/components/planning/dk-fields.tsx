import { PLAN_DK_STATUSES, toDateInputValue } from "@/lib/domain";

type Defaults = {
  name: string;
  subsystemId: string | null;
  status: string;
  statusSince: Date | null;
  note: string | null;
  trApprovedAt: Date | null;
};

type Props = {
  defaults: Defaults;
  subsystems: { id: string; code: string; name: string }[];
};

/** Поля ДК. Номер выдаёт система при заведении, поэтому поля для него нет. */
export function DkFields({ defaults, subsystems }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="field sm:col-span-2">
        Название
        <input name="name" required maxLength={300} defaultValue={defaults.name} className="input" />
      </label>
      <label className="field">
        Подсистема
        <select name="subsystemId" defaultValue={defaults.subsystemId ?? ""} className="input">
          <option value="">Ещё не определена</option>
          {subsystems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Статус
        <select name="status" defaultValue={defaults.status} className="input">
          {PLAN_DK_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Статус с
        <input type="date" name="statusSince" defaultValue={toDateInputValue(defaults.statusSince)} className="input" />
      </label>
      <label className="field">
        ТР согласован
        <input type="date" name="trApprovedAt" defaultValue={toDateInputValue(defaults.trApprovedAt)} className="input" />
      </label>
      <label className="field sm:col-span-2">
        Примечание
        <textarea name="note" rows={3} defaultValue={defaults.note ?? ""} className="input" />
      </label>
    </div>
  );
}
