"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MAX_ATTACHMENT_SIZE, MAX_UPLOAD_BATCH_SIZE } from "@/lib/limits";
import type { ActionResult } from "@/lib/validation";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export type AttachmentRow = {
  id: string;
  fileName: string;
  size: string;
  uploadedBy: string | null;
  createdAt: string;
};

type Props = {
  attachments: AttachmentRow[];
  owner: { field: "taskId" | "letterId" | "documentId" | "meetingId"; id: string };
  upload: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  remove: (formData: FormData) => Promise<void>;
};

/** Вложения записи: список файлов и добавление перетаскиванием или выбором. */
export function AttachmentPanel({ attachments, owner, upload, remove }: Props) {
  const [state, formAction, pending] = useActionState(upload, null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Слишком большой файл отсекаем в браузере: если отправить его на сервер,
   * запрос упрётся в предел тела и страница ответит ошибкой вместо
   * понятного сообщения.
   */
  function tooBig(files: FileList | null): string | null {
    if (!files) return null;

    let total = 0;
    for (const file of files) {
      total += file.size;
      if (file.size > MAX_ATTACHMENT_SIZE) {
        return `Файл «${file.name}» больше ${formatSize(MAX_ATTACHMENT_SIZE)}. Приложите ссылку на него или разделите файл.`;
      }
    }

    // Пачка едет в теле одного запроса, поэтому сумма важна не меньше
    // размера самого большого файла.
    if (total > MAX_UPLOAD_BATCH_SIZE) {
      return `Вместе файлы весят ${formatSize(total)}, а за один раз можно отправить ${formatSize(
        MAX_UPLOAD_BATCH_SIZE,
      )}. Прикрепите их в несколько приёмов.`;
    }
    return null;
  }

  function acceptFiles(files: FileList) {
    if (!inputRef.current || files.length === 0) return;
    const error = tooBig(files);
    if (error) {
      setLocalError(error);
      return;
    }
    setLocalError(null);
    // Кладём перетащенные файлы в поле формы и отправляем её как обычно.
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    inputRef.current.files = transfer.files;
    formRef.current?.requestSubmit();
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-sm font-semibold text-gray-900">Вложения</h2>

      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500">Файлов пока нет.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <a
                href={`/api/attachments/${attachment.id}`}
                className="font-medium text-gray-900 hover:underline"
              >
                {attachment.fileName}
              </a>
              <span className="text-gray-400">{attachment.size}</span>
              <span className="text-gray-400">
                {attachment.uploadedBy ? `${attachment.uploadedBy}, ` : ""}
                {attachment.createdAt}
              </span>
              <form action={remove} className="ml-auto">
                <input type="hidden" name="attachmentId" value={attachment.id} />
                <ConfirmSubmit
                  className="btn-secondary"
                  question="Удалить файл?"
                  confirmLabel="Да, удалить"
                  pendingLabel="…"
                >
                  Убрать
                </ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onSubmit={(event) => {
          const error = tooBig(inputRef.current?.files ?? null);
          setLocalError(error);
          if (error) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          acceptFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm ${
          dragOver ? "border-brand bg-brand-soft" : "border-gray-300 bg-gray-50/60"
        }`}
      >
        <input type="hidden" name={owner.field} value={owner.id} />
        {/* Своя подпись вместо системной кнопки: браузер пишет её на языке
            системы («Choose Files»), а интерфейс должен быть русским. Файл
            уходит сразу после выбора, как и при перетаскивании. */}
        <input
          ref={inputRef}
          id={`attach-${owner.id}`}
          type="file"
          name="file"
          multiple
          onChange={(event) => {
            const error = tooBig(event.target.files);
            setLocalError(error);
            if (!error && event.target.files?.length) formRef.current?.requestSubmit();
          }}
          className="sr-only"
        />
        <label
          htmlFor={`attach-${owner.id}`}
          className="block cursor-pointer text-gray-600 hover:text-gray-900"
        >
          {pending ? (
            "Загружаем…"
          ) : (
            <>
              Перетащите документ сюда или{" "}
              <span className="font-medium text-brand underline-offset-2 hover:underline">
                нажмите, чтобы выбрать файл
              </span>
            </>
          )}
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Один файл — до {formatSize(MAX_ATTACHMENT_SIZE)}, за один раз — до{" "}
          {formatSize(MAX_UPLOAD_BATCH_SIZE)}.
        </p>
        {localError && <p className="mt-2 text-sm text-red-700">{localError}</p>}
        {!localError && state && !state.ok && (
          <p className="mt-2 text-sm text-red-700">{state.error}</p>
        )}
        {state?.ok && state.message && (
          <p className="mt-2 text-sm text-emerald-700">{state.message}</p>
        )}
      </form>
    </section>
  );
}
