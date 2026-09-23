-- Уведомления сотруднику: назначение, смена срока, просрочка, запись без
-- движения. Почты у системы нет, уведомления живут внутри неё.
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ключ события: одно и то же уведомление не повторяется при каждом открытии.
CREATE UNIQUE INDEX "Notification_memberId_dedupKey_key" ON "Notification"("memberId", "dedupKey");
CREATE INDEX "Notification_memberId_readAt_idx" ON "Notification"("memberId", "readAt");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
