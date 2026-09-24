import Link from "next/link";
import {
  ARTIFACT_KINDS,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STAGE_ORDER,
  DOCUMENT_STATUS_LABELS,
  LETTER_DIRECTION_LABELS,
  LETTER_STATUS_LABELS,
  MEETING_KIND_LABELS,
  PROJECT_STATUS_LABELS,
  REFERENCE_SECTIONS,
  SIGNATURE_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/domain";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Что означает каждый статус и вид. Страница собирается из тех же списков,
 * что и формы: разойтись с системой она не может.
 */
export default async function VocabularyPage() {
  await requireUser();

  const groups: { title: string; note: string; rows: [string, string][] }[] = [
    {
      title: "Статусы задачи",
      note: "Заведённая задача всегда получает «Новая»; «Готово» и «Отменена» закрывают срок.",
      rows: TASK_STATUSES.map((status) => [TASK_STATUS_LABELS[status], describeTaskStatus(status)]),
    },
    {
      title: "Приоритеты задачи",
      note: "Приоритет ни на что не влияет автоматически: это подсказка человеку.",
      rows: Object.values(TASK_PRIORITY_LABELS).map((label) => [label, ""]),
    },
    {
      title: "Артефакты задачи",
      note: "Чем работа подтверждается. У задачи их может быть несколько.",
      rows: ARTIFACT_KINDS.map((kind) => [kind.label, kind.placeholder]),
    },
    {
      title: "Направления письма",
      note: "От направления зависит состав полей формы: резолюция или подписант.",
      rows: Object.values(LETTER_DIRECTION_LABELS).map((label) => [label, ""]),
    },
    {
      title: "Статусы письма",
      note: "«Дан ответ», «Подписано», «Принято к сведению» и «Закрыто» снимают срок.",
      rows: Object.entries(LETTER_STATUS_LABELS).map(([, label]) => [label, ""]),
    },
    {
      title: "Виды документов",
      note: "Виды юридического трека, как в исходных реестрах.",
      rows: Object.values(DOCUMENT_KIND_LABELS).map((label) => [label, ""]),
    },
    {
      title: "Стадии документа",
      note: "Порядок сверху вниз — от требующего действий к законченному. «Возвращён на доработку» и «Передан в дело» ставит человек, матрица подписания их не перебивает.",
      rows: DOCUMENT_STAGE_ORDER.map((status) => [DOCUMENT_STATUS_LABELS[status], ""]),
    },
    {
      title: "Статусы стороны подписания",
      note: "Итог документа выводится из статусов сторон; отказ любой стороны блокирует документ.",
      rows: Object.values(SIGNATURE_STATUS_LABELS).map((label) => [label, ""]),
    },
    {
      title: "Виды встреч",
      note: "Вид виден в списке и в карточке, на состав полей не влияет.",
      rows: Object.values(MEETING_KIND_LABELS).map((label) => [label, ""]),
    },
    {
      title: "Статусы проекта",
      note: "",
      rows: Object.values(PROJECT_STATUS_LABELS).map((label) => [label, ""]),
    },
    {
      title: "Разделы справочной информации",
      note: "Список закрытый: иначе разделы расплодятся и справочник станет свалкой заметок.",
      rows: REFERENCE_SECTIONS.map((section) => [section.label, ""]),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/directory" className="text-sm text-gray-500 hover:underline">
          ← Справочники
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Виды и статусы</h1>
        <p className="text-sm text-gray-500">
          Что означает каждый статус, вид и стадия. Страница собирается из тех же списков,
          что и формы, поэтому расходиться с системой не может.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="card min-w-0 p-5">
            <h2 className="text-sm font-semibold text-gray-900">{group.title}</h2>
            {group.note && <p className="mt-1 text-sm text-gray-500">{group.note}</p>}
            <ul className="mt-2 divide-y divide-gray-100">
              {group.rows.map(([label, note]) => (
                <li key={label} className="flex flex-wrap items-baseline gap-2 py-1.5 text-sm">
                  <span className="font-medium text-gray-900">{label}</span>
                  {note && <span className="text-gray-500">{note}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function describeTaskStatus(status: string): string {
  switch (status) {
    case "NEW":
      return "ставится системой при заведении";
    case "DONE":
    case "CANCELLED":
      return "закрывает задачу, срок больше не горит";
    default:
      return "";
  }
}
