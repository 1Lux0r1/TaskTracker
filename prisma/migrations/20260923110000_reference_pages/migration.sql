-- Справочная информация: архитектура системы, паспорт проекта, матрица
-- подписания и прочее, что команда держит рядом с работой.
CREATE TABLE "ReferencePage" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "projectId"   TEXT,
  "section"     TEXT NOT NULL DEFAULT 'OTHER',
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "authorId"    TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "searchIndex" TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "ReferencePage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ReferencePage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ReferencePage_section_idx" ON "ReferencePage"("section");
CREATE INDEX "ReferencePage_projectId_idx" ON "ReferencePage"("projectId");
CREATE INDEX "ReferencePage_searchIndex_idx" ON "ReferencePage"("searchIndex");
