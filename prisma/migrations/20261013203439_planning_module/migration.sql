-- Модуль «Планирование развития»: только новые таблицы, существующие не меняются.
-- Откат: prisma/migrations/20261013203439_planning_module/down.sql (см. docs/planning.md).

-- CreateTable
CREATE TABLE "PlanSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastMsNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanDirection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "deadline" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'MAIN',
    "decisionDate" DATETIME,
    "decisionBasis" TEXT,
    "oftApprovedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanDirection_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "PlanSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanDirectionPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "directionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanDirectionPart_directionId_fkey" FOREIGN KEY ("directionId") REFERENCES "PlanDirection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanSubsystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanSubsystem_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "PlanSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "systemId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "subsystemId" TEXT NOT NULL,
    "version" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanModule_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "PlanSystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanModule_subsystemId_fkey" FOREIGN KEY ("subsystemId") REFERENCES "PlanSubsystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanDk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "subsystemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRESTUDY',
    "statusSince" DATETIME,
    "note" TEXT,
    "trApprovedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanDk_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PlanDirectionPart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanDk_subsystemId_fkey" FOREIGN KEY ("subsystemId") REFERENCES "PlanSubsystem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dkId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "moduleId" TEXT,
    "repeat" INTEGER NOT NULL DEFAULT 1,
    "cipher" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationWeeks" INTEGER,
    "startDate" DATETIME,
    "finishDate" DATETIME,
    "searchIndex" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanTask_dkId_fkey" FOREIGN KEY ("dkId") REFERENCES "PlanDk" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PlanStage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlanTask_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "PlanModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanSystem_code_key" ON "PlanSystem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDirection_systemId_code_key" ON "PlanDirection"("systemId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDirectionPart_directionId_code_key" ON "PlanDirectionPart"("directionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSubsystem_systemId_code_key" ON "PlanSubsystem"("systemId", "code");

-- CreateIndex
CREATE INDEX "PlanModule_subsystemId_idx" ON "PlanModule"("subsystemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanModule_systemId_number_key" ON "PlanModule"("systemId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PlanStage_code_key" ON "PlanStage"("code");

-- CreateIndex
CREATE INDEX "PlanDk_subsystemId_idx" ON "PlanDk"("subsystemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDk_partId_number_key" ON "PlanDk"("partId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PlanTask_cipher_key" ON "PlanTask"("cipher");

-- CreateIndex
CREATE INDEX "PlanTask_dkId_idx" ON "PlanTask"("dkId");

-- CreateIndex
CREATE INDEX "PlanTask_moduleId_idx" ON "PlanTask"("moduleId");

-- CreateIndex
CREATE INDEX "PlanTask_searchIndex_idx" ON "PlanTask"("searchIndex");
