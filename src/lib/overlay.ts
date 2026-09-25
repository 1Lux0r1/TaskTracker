import type { OverlayMode } from "@/components/overlay-panel";

/**
 * Режим формы берётся из адреса: календарь зовёт формы с `panel=modal` и
 * получает окно посередине, остальные экраны — панель справа.
 *
 * Модуль отдельный от самой панели: панель клиентская, а вызывают эту
 * функцию серверные страницы.
 */
export function overlayMode(value: string | string[] | undefined): OverlayMode {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "modal" ? "modal" : "sheet";
}
