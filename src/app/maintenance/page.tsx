import Link from "next/link";
import { makeBackup, rebuildSearch, restoreFromBackup } from "@/app/actions/maintenance";
import { MaintenanceAction } from "@/components/maintenance-action";
import { requireUser } from "@/lib/auth";
import { backupPaths, listBackups } from "@/lib/backup";
import { formatDateTime, plural } from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata = { title: "Обслуживание — TaskTracker" };

/** Копия старше этого срока считается тревогой: ежедневная, видимо, не снимается. */
const STALE_DAYS = 2;

/**
 * Обслуживание системы кнопками вместо команд: резервные копии,
 * восстановление, пересборка поиска. Раздел администратора — восстановление
 * меняет данные у всех.
 */
export default async function MaintenancePage() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
          Обслуживание
        </h1>
        <p className="card mt-4 p-6 text-sm text-gray-600">
          Резервные копии и восстановление ведёт администратор.
        </p>
      </div>
    );
  }

  const paths = backupPaths();
  const backups = listBackups(paths);
  const last = backups[0];
  const ageDays = last ? daysSince(last.createdAt) : null;
  const stale = ageDays === null || ageDays >= STALE_DAYS;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
          Обслуживание
        </h1>
        <p className="mt-1 max-w-[62ch] text-sm text-gray-600">
          Резервные копии, восстановление и поиск. Всё делается здесь, без командной строки.
        </p>
      </div>

      <section className="card card-accent mb-3.5 overflow-hidden">
        <div className="flex flex-wrap items-start gap-3 px-4.5 pt-4.5 pb-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15.5px] font-semibold text-gray-900">
              Резервные копии
            </h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              В копию входят база и все вложения. Хранятся последние {paths.keep}, старые
              удаляются сами.
            </p>
          </div>
          <MaintenanceAction action={makeBackup} pendingLabel="Снимаем копию…">
            Снять копию сейчас
          </MaintenanceAction>
        </div>

        <div className="px-4.5 pb-3.5">
          <p
            className={
              stale
                ? "rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
                : "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            }
          >
            {last
              ? `Последняя копия: ${formatDateTime(last.createdAt)}, ${ageLabel(ageDays ?? 0)}.`
              : "Копий ещё нет."}{" "}
            {stale &&
              "Ежедневная копия в 3:00 снимается, только если включён автозапуск; пока снимите копию кнопкой."}
          </p>
          <p className="mt-2 text-[13px] text-gray-500">
            Папка с копиями: <span className="font-mono text-[12.5px]">{paths.backupDir}</span>.
            Чтобы копии пережили поломку диска, эта папка должна лежать на другом диске или в
            облачной папке.
          </p>
        </div>

        {backups.length > 0 && (
          <ul className="border-t border-gray-200">
            {backups.map((backup, index) => (
              <li
                key={backup.name}
                className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4.5 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(backup.createdAt)}
                    {index === 0 && (
                      <span className="bg-brand-soft text-brand ml-2 rounded-full px-2 py-0.5 text-xs">
                        последняя
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-gray-500">
                    База {formatSize(backup.databaseBytes)} · вложений {backup.attachmentFiles}
                    {backup.note && ` · ${backup.note}`}
                  </p>
                </div>
                <MaintenanceAction
                  action={restoreFromBackup}
                  fields={{ name: backup.name }}
                  className="btn-secondary"
                  pendingLabel="Восстанавливаем…"
                  confirm={{
                    question: "Заменить все данные этой копией? Текущие сохранятся отдельной копией.",
                    label: "Да, восстановить",
                  }}
                >
                  Восстановить
                </MaintenanceAction>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className="card card-accent space-y-3 p-4.5">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold text-gray-900">Поиск</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Если поиск перестал находить записи по-русски (например, данные перенесли в базу
              напрямую), пересоберите его. Записи при этом не меняются.
            </p>
          </div>
          <MaintenanceAction
            action={rebuildSearch}
            className="btn-secondary"
            pendingLabel="Пересобираем…"
          >
            Пересобрать поиск
          </MaintenanceAction>
        </section>

        <section className="card card-accent space-y-3 p-4.5">
          <div>
            <h2 className="font-display text-[15.5px] font-semibold text-gray-900">
              Загрузка и выгрузка Excel
            </h2>
            <p className="mt-0.5 text-[13px] text-gray-500">
              Реестры из Excel загружаются на странице импорта, выгрузка — кнопкой на каждом
              реестре или отсюда.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/import" className="btn-primary">
              Загрузить из Excel
            </Link>
            <Link href="/api/export" className="btn-secondary">
              Задачи
            </Link>
            <Link href="/api/export?entity=letters" className="btn-secondary">
              Письма
            </Link>
            <Link href="/api/export?entity=documents" className="btn-secondary">
              Документы
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Сколько полных суток прошло с момента снятия копии. */
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function ageLabel(days: number): string {
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} ${plural(days, "день", "дня", "дней")} назад`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}
