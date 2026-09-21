-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Letter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'INCOMING',
    "date" DATETIME,
    "subject" TEXT NOT NULL,
    "url" TEXT,
    "counterpartyId" TEXT,
    "ownerId" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "statusNote" TEXT,
    "responseRef" TEXT,
    "externalTaskKey" TEXT,
    "comment" TEXT,
    "closedAt" DATETIME,
    "responseToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Letter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Letter_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Letter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Letter_responseToId_fkey" FOREIGN KEY ("responseToId") REFERENCES "Letter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Letter" ("closedAt", "comment", "counterpartyId", "createdAt", "date", "direction", "dueDate", "externalTaskKey", "id", "number", "ownerId", "projectId", "responseRef", "responseToId", "status", "statusNote", "subject", "updatedAt", "url") SELECT "closedAt", "comment", "counterpartyId", "createdAt", "date", "direction", "dueDate", "externalTaskKey", "id", "number", "ownerId", "projectId", "responseRef", "responseToId", "status", "statusNote", "subject", "updatedAt", "url" FROM "Letter";
DROP TABLE "Letter";
ALTER TABLE "new_Letter" RENAME TO "Letter";
CREATE INDEX "Letter_status_idx" ON "Letter"("status");
CREATE INDEX "Letter_dueDate_idx" ON "Letter"("dueDate");
CREATE INDEX "Letter_direction_idx" ON "Letter"("direction");
CREATE UNIQUE INDEX "Letter_projectId_number_direction_key" ON "Letter"("projectId", "number", "direction");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
