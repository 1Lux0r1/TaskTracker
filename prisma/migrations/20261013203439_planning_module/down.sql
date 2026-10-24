-- Откат модуля «Планирование развития». Удаляет только его таблицы,
-- остальные данные системы не затрагиваются. Порядок — от зависимых к главным.
DROP TABLE IF EXISTS "PlanTask";
DROP TABLE IF EXISTS "PlanDk";
DROP TABLE IF EXISTS "PlanStage";
DROP TABLE IF EXISTS "PlanModule";
DROP TABLE IF EXISTS "PlanSubsystem";
DROP TABLE IF EXISTS "PlanDirectionPart";
DROP TABLE IF EXISTS "PlanDirection";
DROP TABLE IF EXISTS "PlanSystem";

-- Снимаем отметку о применении, чтобы `prisma migrate deploy` при
-- необходимости накатил модуль заново.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261013203439_planning_module';
