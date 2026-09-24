-- Встречи: повестка, участники, решения и материалы.
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "place" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'WORKING',
    "subject" TEXT NOT NULL,
    "agenda" TEXT,
    "decisions" TEXT,
    "ownerId" TEXT,
    "invitationSentAt" DATETIME,
    "materialsSentAt" DATETIME,
    "searchIndex" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Meeting_projectId_date_idx" ON "Meeting"("projectId", "date");
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");
CREATE INDEX "Meeting_searchIndex_idx" ON "Meeting"("searchIndex");

-- Ответственные представители организаций.
CREATE TABLE "OrgContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "counterpartyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "comment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgContact_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrgContact_counterpartyId_idx" ON "OrgContact"("counterpartyId");
CREATE INDEX "OrgContact_fullName_idx" ON "OrgContact"("fullName");

-- Участники встречи: свой сотрудник, представитель организации или имя текстом.
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "orgContactId" TEXT,
    "externalName" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingParticipant_orgContactId_fkey" FOREIGN KEY ("orgContactId") REFERENCES "OrgContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");

-- Вложение крепится и ко встрече: материалы лежат рядом с записью.
ALTER TABLE "Attachment" ADD COLUMN "meetingId" TEXT REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Attachment_meetingId_idx" ON "Attachment"("meetingId");

-- Задача, заведённая из решения встречи, помнит, откуда она.
ALTER TABLE "Task" ADD COLUMN "meetingId" TEXT REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
