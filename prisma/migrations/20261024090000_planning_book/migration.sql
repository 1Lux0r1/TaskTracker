-- Формат шифра книги планирования: номер МС внутри подсистемы, срок пункта
-- дорожной карты (ДК). Только новые колонки и индекс, данные не теряются.

-- AlterTable
ALTER TABLE "PlanDk" ADD COLUMN "deadline" DATETIME;

-- AlterTable
ALTER TABLE "PlanModule" ADD COLUMN "subsystemNumber" INTEGER;

-- AlterTable
ALTER TABLE "PlanSubsystem" ADD COLUMN "lastMsNumber" INTEGER NOT NULL DEFAULT 0;

-- Уже заведённые МС нумеруются внутри подсистемы по порядку реестра.
UPDATE "PlanModule" SET "subsystemNumber" = (
    SELECT COUNT(*) FROM "PlanModule" AS "other"
    WHERE "other"."subsystemId" = "PlanModule"."subsystemId" AND "other"."number" <= "PlanModule"."number"
);
UPDATE "PlanSubsystem" SET "lastMsNumber" = COALESCE(
    (SELECT MAX("subsystemNumber") FROM "PlanModule" WHERE "PlanModule"."subsystemId" = "PlanSubsystem"."id"), 0
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanModule_subsystemId_subsystemNumber_key" ON "PlanModule"("subsystemId", "subsystemNumber");
