import type { LetterInput } from "@/lib/validation";

/**
 * Поля, которых у направления не бывает, не сохраняем: резолюция есть только
 * у входящего письма, подписант — только у исходящего.
 *
 * Связь «в ответ на» есть у обоих направлений: мы отвечаем исходящим на
 * входящее, организация отвечает входящим на наше исходящее — в реальной
 * переписке второй случай даже чаще. Ограничение одно: ответ не может быть
 * ответом сам на себя, а направление исходного письма проверяется на сервере,
 * где известно само письмо.
 *
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
      selfId !== undefined && input.responseToId === selfId ? null : input.responseToId,
    dueDate: answerNotRequired ? null : input.dueDate,
    status:
      answerNotRequired && (input.status === "NEW" || input.status === "IN_PROGRESS")
        ? "NOTED"
        : input.status,
  };
}

/** Направление письма, на которое можно ответить письмом этого направления. */
export function oppositeDirection(direction: string): string {
  return direction === "INCOMING" ? "OUTGOING" : "INCOMING";
}

/**
 * Подпись поля «в ответ на»: у исходящего письма отвечают на входящее,
 * у входящего — на наше исходящее.
 */
export function answerFieldLabel(direction: string): string {
  return direction === "INCOMING" ? "В ответ на наше исходящее" : "В ответ на входящее";
}

/**
 * Письма, которые годятся в основание ответа: тот же проект, противоположное
 * направление, не само письмо и не ответ на него. Последнее замкнуло бы
 * кольцо: письмо отвечало бы на собственный ответ, и цепочку переписки стало
 * бы нечем читать.
 */
export function answerCandidates<
  T extends { id: string; projectId: string; direction: string; responseToId?: string | null },
>(letters: T[], options: { direction: string; projectId: string; selfId?: string }): T[] {
  const wanted = oppositeDirection(options.direction);
  return letters.filter(
    (letter) =>
      letter.projectId === options.projectId &&
      letter.direction === wanted &&
      letter.id !== options.selfId &&
      (options.selfId === undefined || letter.responseToId !== options.selfId),
  );
}
