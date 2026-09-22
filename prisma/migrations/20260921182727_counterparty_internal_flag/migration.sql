-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Counterparty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Counterparty" ("createdAt", "id", "isActive", "name", "shortName") SELECT "createdAt", "id", "isActive", "name", "shortName" FROM "Counterparty";
DROP TABLE "Counterparty";
ALTER TABLE "new_Counterparty" RENAME TO "Counterparty";
CREATE UNIQUE INDEX "Counterparty_name_key" ON "Counterparty"("name");
CREATE INDEX "Counterparty_name_idx" ON "Counterparty"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
