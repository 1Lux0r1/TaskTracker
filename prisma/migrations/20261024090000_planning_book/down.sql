-- Откат миграции 20261024090000_planning_book: колонки удаляются, строка
-- миграции стирается из журнала, чтобы prisma migrate deploy применил её снова.
DROP INDEX IF EXISTS "PlanModule_subsystemId_subsystemNumber_key";
ALTER TABLE "PlanModule" DROP COLUMN "subsystemNumber";
ALTER TABLE "PlanSubsystem" DROP COLUMN "lastMsNumber";
ALTER TABLE "PlanDk" DROP COLUMN "deadline";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261024090000_planning_book';
