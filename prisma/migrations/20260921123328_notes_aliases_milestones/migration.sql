/*
  Warnings:

  - You are about to drop the `Comment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "Comment_taskId_idx";

-- AlterTable
ALTER TABLE "DocumentSignature" ADD COLUMN "basisLetterId" TEXT;
ALTER TABLE "DocumentSignature" ADD COLUMN "refusalReason" TEXT;
ALTER TABLE "DocumentSignature" ADD COLUMN "respondedAt" DATETIME;
ALTER TABLE "DocumentSignature" ADD COLUMN "sentAt" DATETIME;

-- AlterTable
ALTER TABLE "Letter" ADD COLUMN "responseToId" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Comment";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "letterId" TEXT,
    "documentId" TEXT,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "occurredOn" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CounterpartyAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "counterpartyId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    CONSTRAINT "CounterpartyAlias_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CounterpartyMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "plannedDate" DATETIME,
    "actualDate" DATETIME,
    "comment" TEXT,
    CONSTRAINT "CounterpartyMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CounterpartyMilestone_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "releaseInfo" TEXT,
    "done" TEXT,
    "planned" TEXT,
    "blockers" TEXT,
    "solutions" TEXT,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklyReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WeeklyReport" ("authorId", "blockers", "createdAt", "done", "id", "periodEnd", "periodStart", "planned", "projectId", "releaseInfo", "solutions", "updatedAt") SELECT "authorId", "blockers", "createdAt", "done", "id", "periodEnd", "periodStart", "planned", "projectId", "releaseInfo", "solutions", "updatedAt" FROM "WeeklyReport";
DROP TABLE "WeeklyReport";
ALTER TABLE "new_WeeklyReport" RENAME TO "WeeklyReport";
CREATE INDEX "WeeklyReport_periodEnd_idx" ON "WeeklyReport"("periodEnd");
CREATE UNIQUE INDEX "WeeklyReport_projectId_periodStart_periodEnd_key" ON "WeeklyReport"("projectId", "periodStart", "periodEnd");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Note_taskId_occurredOn_idx" ON "Note"("taskId", "occurredOn");

-- CreateIndex
CREATE INDEX "Note_letterId_occurredOn_idx" ON "Note"("letterId", "occurredOn");

-- CreateIndex
CREATE INDEX "Note_documentId_occurredOn_idx" ON "Note"("documentId", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "CounterpartyAlias_alias_key" ON "CounterpartyAlias"("alias");

-- CreateIndex
CREATE INDEX "CounterpartyAlias_counterpartyId_idx" ON "CounterpartyAlias"("counterpartyId");

-- CreateIndex
CREATE INDEX "CounterpartyMilestone_projectId_plannedDate_idx" ON "CounterpartyMilestone"("projectId", "plannedDate");

-- CreateIndex
CREATE UNIQUE INDEX "CounterpartyMilestone_projectId_counterpartyId_stage_key" ON "CounterpartyMilestone"("projectId", "counterpartyId", "stage");
