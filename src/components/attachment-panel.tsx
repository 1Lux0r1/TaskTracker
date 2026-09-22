"use client";

import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { ActionResult } from "@/lib/validation";

export type AttachmentRow = {
  id: string;
  fileName: string;
  size: string;
  uploadedBy: string | null;
  createdAt: string;
};

type Props = {
  attachments: AttachmentRow[];
  owner: { field: "taskId" | "letterId" | "documentId"; id: string };
  upload: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  remove: (formData: FormData) => Promise<void>;
};

/** Вложения записи: список файлов и добавление перетаскиванием или выбором. */
export function AttachmentPanel({ attachments, owner, upload, remove }: Props) {
  const [state, formAction] = useActionState(upload, null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function acceptFiles(files: FileList) {
    if (!inputRef.current || files.length === 0) return;
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
                <SubmitButton className="btn-secondary" pendingLabel="…">
                  Убрать
                </SubmitButton>
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
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          acceptFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm ${
          dragOver ? "border-gray-900 bg-gray-50" : "border-gray-200"
        }`}
      >
        <input type="hidden" name={owner.field} value={owner.id} />
        <input ref={inputRef} type="file" name="file" multiple className="mx-auto block text-sm" />
        <p className="mt-2 text-gray-500">Перетащите файлы сюда или выберите их выше.</p>
        <div className="mt-3">
          <SubmitButton pendingLabel="Загружаем…">Прикрепить</SubmitButton>
        </div>
        {state && !state.ok && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
        {state?.ok && state.message && (
          <p className="mt-2 text-sm text-emerald-700">{state.message}</p>
        )}
      </form>
    </section>
  );
}
