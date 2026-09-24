import { addNote, deleteNote } from "@/app/actions/tasks";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, toDateInputValue } from "@/lib/domain";
import { ConfirmSubmit } from "@/components/confirm-submit";

export type NoteItem = {
  id: string;
  body: string;
  occurredOn: Date;
  author: { fullName: string } | null;
};

type Props = {
  notes: NoteItem[];
  members: { id: string; fullName: string }[];
  /** Ровно одно из трёх: к чему относится лента. */
  taskId?: string;
  letterId?: string;
  documentId?: string;
  title?: string;
};

/**
 * Лента хроники с датой события. Именно сюда переезжает содержимое колонки
 * «Статус» из исходных таблиц — там она ведётся как журнал, а не как состояние.
 */
export function NoteFeed({
  notes,
  members,
  taskId,
  letterId,
  documentId,
  title = "Хроника",
}: Props) {
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>

      <form action={addNote} className="space-y-2">
        {taskId && <input type="hidden" name="taskId" value={taskId} />}
        {letterId && <input type="hidden" name="letterId" value={letterId} />}
        {documentId && <input type="hidden" name="documentId" value={documentId} />}
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Что произошло"
          className="input"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-500">
            Дата события
            <input
              type="date"
              name="occurredOn"
              defaultValue={toDateInputValue(new Date())}
              className="input w-44"
            />
          </label>
          <select name="authorId" defaultValue="" className="input w-52 self-end">
            <option value="">Без автора</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
          <div className="self-end">
            <SubmitButton pendingLabel="Добавляем…">Добавить</SubmitButton>
          </div>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">Записей пока нет.</p>
      ) : (
        <ol className="space-y-3 border-l border-gray-200 pl-4">
          {notes.map((note) => (
            <li key={note.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-gray-300" />
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium text-gray-500 tabular-nums">
                  {formatDate(note.occurredOn)}
                  {note.author && <span className="font-normal"> · {note.author.fullName}</span>}
                </p>
                <form action={deleteNote}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <ConfirmSubmit
                    className="text-xs text-gray-400 hover:text-red-600"
                    question="Удалить запись?"
                    confirmLabel="да"
                    pendingLabel="…"
                  >
                    удалить
                  </ConfirmSubmit>
                </form>
              </div>
              <p className="mt-0.5 text-sm whitespace-pre-line text-gray-800">{note.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
