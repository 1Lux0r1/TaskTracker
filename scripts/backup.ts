/**
 * Резервная копия и восстановление из командной строки. То же самое есть на
 * кнопках в разделе «Обслуживание»; команду зовёт ежедневный планировщик.
 *
 *   npm run backup                  — снять копию
 *   npm run backup -- --list        — показать, какие копии есть
 *   npm run backup -- --restore ГГГГ-ММ-ДД-ЧЧММСС   — восстановить из копии
 *
 * Сама работа — в src/lib/backup.ts.
 */
import { backupNames, backupPaths, createBackup, restoreBackup } from "../src/lib/backup";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const paths = backupPaths();

  if (args.includes("--list")) {
    const list = backupNames(paths);
    console.log(list.length === 0 ? `Копий нет: ${paths.backupDir}` : list.join("\n"));
    return;
  }

  const restoreIndex = args.indexOf("--restore");
  if (restoreIndex !== -1) {
    const name = args[restoreIndex + 1];
    if (!name) throw new Error("Укажите копию: npm run backup -- --restore 2026-09-24-030000");
    // Из командной строки восстанавливается и копия другой версии системы:
    // миграции после этого доводят базу до текущего кода.
    const result = await restoreBackup(paths, name, { anyVersion: true });
    console.log(`Восстановлено из ${result.name}.`);
    if (result.safetyCopy) {
      console.log(`Прежние данные сохранены копией ${result.safetyCopy}.`);
    }
    console.log("Дальше запустите: npm run db:deploy");
    return;
  }

  const created = await createBackup(paths);
  console.log(`Копия готова: ${created.folder}`);
  console.log(`Таблиц в копии: ${created.tables}. Храним последние ${paths.keep}.`);
  if (created.removed.length > 0) console.log(`Удалены старые копии: ${created.removed.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
