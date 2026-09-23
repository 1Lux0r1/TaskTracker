-- Признак публичного отображения у задачи, письма и документа.
-- Работа проекта по умолчанию идёт в отчёт, переписка остаётся служебной:
-- в письмах реквизиты и ФИО, которые наружу не нужны.
ALTER TABLE "Task" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Letter" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- Журнал смен видимости: после создания признак меняет только администратор.
CREATE TABLE "VisibilityChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisibilityChange_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "VisibilityChange_entity_entityId_idx" ON "VisibilityChange"("entity", "entityId");
CREATE INDEX "VisibilityChange_createdAt_idx" ON "VisibilityChange"("createdAt");
