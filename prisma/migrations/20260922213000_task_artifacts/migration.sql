-- «Результат» одной строкой заменяется артефактами: их у задачи бывает
-- несколько, и у каждого свой вид.

CREATE TABLE "TaskArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM_LINK',
    "label" TEXT,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskArtifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaskArtifact_taskId_sortOrder_idx" ON "TaskArtifact"("taskId", "sortOrder");

-- Перенос: ссылка на карточку ЭДО узнаётся по адресу, прочие ссылки остаются
-- своими ссылками, текст без адреса — своим значением.
INSERT INTO "TaskArtifact" ("id", "taskId", "kind", "label", "value", "sortOrder", "createdAt")
SELECT
    lower(hex(randomblob(12))),
    t."id",
    CASE
        WHEN t."resultLink" LIKE '%mosedo%' THEN 'EDO_LINK'
        WHEN t."resultLink" LIKE 'http%' THEN 'CUSTOM_LINK'
        ELSE 'CUSTOM_VALUE'
    END,
    'Результат',
    trim(t."resultLink"),
    0,
    CURRENT_TIMESTAMP
FROM "Task" t
WHERE t."resultLink" IS NOT NULL AND trim(t."resultLink") <> '';

ALTER TABLE "Task" DROP COLUMN "resultLink";
