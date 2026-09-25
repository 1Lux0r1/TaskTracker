"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type OverlayMode = "sheet" | "modal";

type Props = {
  title: string;
  /** Подпись под заголовком: чем эта форма отличается от соседних. */
  note?: string;
  mode?: OverlayMode;
  children: React.ReactNode;
};

/**
 * Форма заведения записи поверх текущего экрана: справа выезжающей панелью,
 * а из календаря — окном посередине. Под ней остаётся тот экран, с которого
 * запись заводят, поэтому уходить со страницы не нужно.
 *
 * Панель открывается перехватом адреса, поэтому закрытие — это шаг назад по
 * истории: прямое открытие того же адреса покажет обычную страницу.
 */
export function OverlayPanel({ title, note, mode = "sheet", children }: Props) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [router]);

  const close = () => router.back();

  const head = (
    <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-gray-200 bg-white px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-gray-500">{note}</p>}
      </div>
      <button type="button" onClick={close} className="btn-secondary ml-auto flex-none">
        Закрыть
      </button>
    </header>
  );

  return (
    <>
      <div
        onClick={close}
        aria-hidden
        className="scrim-in fixed inset-0 z-40 bg-gray-950/40 backdrop-blur-[2px]"
      />
      {mode === "modal" ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="window-in pointer-events-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            {head}
            <div className="px-5 py-5">{children}</div>
          </div>
        </div>
      ) : (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="panel-in fixed inset-y-0 right-0 z-50 w-[min(780px,100%)] overflow-y-auto border-l border-gray-200 bg-white shadow-2xl"
        >
          {head}
          <div className="px-5 py-5">{children}</div>
        </aside>
      )}
    </>
  );
}

/**
 * Экран заведения записи. Один и тот же компонент рисуется и отдельной
 * страницей (прямая ссылка, обновление), и внутри панели — тогда заголовок
 * и возврат берёт на себя панель.
 */
export type NewScreenProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  inPanel?: boolean;
};
