import { PLAN_PRIORITIES, toDateInputValue } from "@/lib/domain";

type Defaults = {
  id?: string;
  systemId: string;
  code: string;
  name: string;
  goal: string | null;
  deadline: Date | null;
  priority: string;
  decisionDate: Date | null;
  decisionBasis: string | null;
  oftApprovedAt: Date | null;
};

/** Поля направления: решение руководства — цель и срок, без способа. */
export function DirectionFields({ defaults }: { defaults: Defaults }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="systemId" value={defaults.systemId} />
      <label className="field">
        Код
        <input name="code" required maxLength={12} defaultValue={defaults.code} className="input font-mono" placeholder="Gaz" />
      </label>
      <label className="field">
        Приоритет
        <select name="priority" defaultValue={defaults.priority} className="input">
          {PLAN_PRIORITIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field sm:col-span-2">
        Название
        <input name="name" required maxLength={300} defaultValue={defaults.name} className="input" />
      </label>
      <label className="field sm:col-span-2">
        Цель
        <textarea name="goal" rows={3} defaultValue={defaults.goal ?? ""} className="input" placeholder="Чего руководство ждёт от направления" />
      </label>
      <label className="field">
        Срок
        <input type="date" name="deadline" defaultValue={toDateInputValue(defaults.deadline)} className="input" />
      </label>
      <label className="field">
        ОФТ согласован
        <input type="date" name="oftApprovedAt" defaultValue={toDateInputValue(defaults.oftApprovedAt)} className="input" />
      </label>
      <label className="field">
        Дата решения
        <input type="date" name="decisionDate" defaultValue={toDateInputValue(defaults.decisionDate)} className="input" />
      </label>
      <label className="field">
        Основание решения
        <input name="decisionBasis" maxLength={300} defaultValue={defaults.decisionBasis ?? ""} className="input" placeholder="Протокол, поручение" />
      </label>
    </div>
  );
}
