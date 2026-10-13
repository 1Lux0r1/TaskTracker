import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/planning/action-form";
import type { ActionResult } from "@/lib/validation";

type Props = {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  id: string;
  question: string;
};

/** Удаление строки справочника с подтверждением; отказ сервера виден у строки. */
export function RowDelete({ action, id, question }: Props) {
  return (
    <ActionForm action={action} className="flex flex-col items-end">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit className="btn-secondary px-2.5 py-1 text-[13px]" question={question}>
        Удалить
      </ConfirmSubmit>
    </ActionForm>
  );
}
