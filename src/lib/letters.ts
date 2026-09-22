import type { LetterInput } from "@/lib/validation";

/**
 * Поля, которых у направления не бывает, не сохраняем: резолюция есть только
 * у входящего письма, подписант и ссылка «в ответ на» — только у исходящего.
 * Отметка «ответ не требуется» снимает срок и ставит «принято к сведению»,
 * если работа по письму ещё не размечена иначе.
 * `selfId` при правке: письмо не может быть ответом само на себя.
 */
export function normalizeLetterByDirection<T extends LetterInput>(
  input: T,
  options: { answerNotRequired: boolean; selfId?: string },
): T {
  const incoming = input.direction === "INCOMING";
  const { answerNotRequired, selfId } = options;

  return {
    ...input,
    resolution: incoming ? input.resolution : null,
    signatory: incoming ? null : input.signatory,
    responseToId:
      incoming || (selfId !== undefined && input.responseToId === selfId)
        ? null
        : input.responseToId,
    dueDate: answerNotRequired ? null : input.dueDate,
    status:
      answerNotRequired && (input.status === "NEW" || input.status === "IN_PROGRESS")
        ? "NOTED"
        : input.status,
  };
}
