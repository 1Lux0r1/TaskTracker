-- Трек работ становится записью справочника проекта.
-- Существующие задачи переносятся по коду трека, данные не теряются.

-- 1. Справочник
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Track_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Track_projectId_name_key" ON "Track"("projectId", "name");
CREATE INDEX "Track_projectId_sortOrder_idx" ON "Track"("projectId", "sortOrder");

-- 2. Четыре трека из Excel каждому проекту
INSERT INTO "Track" ("id", "projectId", "key", "name", "color", "sortOrder", "isArchived", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), p."id", base."key", base."name", base."color", base."sortOrder", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project" p
CROSS JOIN (
    SELECT 'PRODUCTION' AS "key", 'Производственный' AS "name", 'blue' AS "color", 0 AS "sortOrder"
    UNION ALL SELECT 'INTERNAL', 'Внутренний', 'gray', 1
    UNION ALL SELECT 'EXTERNAL', 'Внешний', 'orange', 2
    UNION ALL SELECT 'LEGAL', 'Юридический', 'purple', 3
) base;

-- 3. Задача ссылается на трек вместо строки
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "parentId" TEXT,
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "estimateHours" REAL,
    "spentHours" REAL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "externalKey" TEXT,
    "trackId" TEXT NOT NULL,
    "externalAssignee" TEXT,
    "externalTaskKey" TEXT,
    "progressNote" TEXT,
    "resultLink" TEXT,
    "letterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Task" ("id", "projectId", "number", "title", "description", "status", "priority", "assigneeId", "parentId", "startDate", "dueDate", "completedAt", "estimateHours", "spentHours", "progress", "sortOrder", "externalKey", "trackId", "externalAssignee", "externalTaskKey", "progressNote", "resultLink", "letterId", "createdAt", "updatedAt")
SELECT t."id", t."projectId", t."number", t."title", t."description", t."status", t."priority", t."assigneeId", t."parentId", t."startDate", t."dueDate", t."completedAt", t."estimateHours", t."spentHours", t."progress", t."sortOrder", t."externalKey",
    COALESCE(
        (SELECT tr."id" FROM "Track" tr WHERE tr."projectId" = t."projectId" AND tr."key" = t."track"),
        (SELECT tr."id" FROM "Track" tr WHERE tr."projectId" = t."projectId" AND tr."key" = 'PRODUCTION')
    ),
    t."externalAssignee", t."externalTaskKey", t."progressNote", t."resultLink", t."letterId", t."createdAt", t."updatedAt"
FROM "Task" t;

DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";

CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_trackId_idx" ON "Task"("trackId");
CREATE UNIQUE INDEX "Task_projectId_number_key" ON "Task"("projectId", "number");
CREATE UNIQUE INDEX "Task_projectId_externalKey_key" ON "Task"("projectId", "externalKey");

PRAGMA foreign_keys=ON;
