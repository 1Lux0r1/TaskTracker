-- Сохранённые наборы фильтров реестров. Набор личный: имя уникально в
-- пределах одного сотрудника и одного реестра.
CREATE TABLE "FilterPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FilterPreset_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FilterPreset_memberId_scope_name_key" ON "FilterPreset"("memberId", "scope", "name");
CREATE INDEX "FilterPreset_memberId_scope_idx" ON "FilterPreset"("memberId", "scope");
