-- Поиск, календарь и опоры для аналитики.
-- Всё, что Prisma не умеет описать в schema.prisma: генерируемые колонки,
-- индексы pg_trgm, полнотекстовый поиск и представления.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── Поиск по номеру письма ────────────────────────────────────────────────
-- Номер вида «64-01-16906/26» человек помнит частями: ищет «16906» или
-- «16906/26». Поэтому нужны обе формы: исходная и без разделителей, чтобы
-- нашлось и «64011690626».

ALTER TABLE "Letter"
  ADD COLUMN "numberDigits" text
  GENERATED ALWAYS AS (regexp_replace("number", '[^0-9]', '', 'g')) STORED;

CREATE INDEX "Letter_number_trgm_idx"       ON "Letter" USING GIN ("number" gin_trgm_ops);
CREATE INDEX "Letter_numberDigits_trgm_idx" ON "Letter" USING GIN ("numberDigits" gin_trgm_ops);

-- ─── Полнотекстовый поиск по письмам ───────────────────────────────────────
-- Русская конфигурация со стеммингом: «согласование», «согласования» и
-- «согласовании» сводятся к одной основе и находят друг друга.
--
-- Границы этого слоя проверены на живой базе, и их надо знать:
--   • стеммер не связывает части речи: «согласовать» даёт основу «согласова»,
--     а «согласование» — «согласован», и одно другое не найдёт;
--   • составное слово — один токен, поэтому «геотрест» не найдёт
--     «Мосгоргеотрест».
-- Обе ситуации для этих данных обычны (названия организаций, поиск с
-- полуслова), поэтому ниже добавлен второй слой: триграммный поиск по
-- фрагменту. Запрос объединяет оба и не полагается на один.
--
-- Тема весит больше остального (вес A против B).

ALTER TABLE "Letter"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce("subject", '')), 'A') ||
    setweight(to_tsvector('russian', coalesce("responseRequisites", '')), 'B') ||
    setweight(to_tsvector('russian', coalesce("comment", '')), 'B')
  ) STORED;

CREATE INDEX "Letter_searchVector_idx" ON "Letter" USING GIN ("searchVector");

-- Заметки по письму в индекс письма не попадают: генерируемая колонка не
-- может читать другую таблицу. Поиск по тексту заметок идёт своим индексом,
-- а запрос объединяет оба результата.
ALTER TABLE "Note"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('russian', coalesce("body", ''))) STORED;

CREATE INDEX "Note_searchVector_idx" ON "Note" USING GIN ("searchVector");

-- ─── Второй слой: поиск по фрагменту слова ─────────────────────────────────
-- Триграммные индексы по приведённому к нижнему регистру тексту. Дают
-- индексированный ILIKE '%фрагмент%' там, где полнотекстовый поиск бессилен:
-- часть составного слова, название организации, поиск с полуслова.

ALTER TABLE "Letter"
  ADD COLUMN "subjectFold" text
  GENERATED ALWAYS AS (lower(coalesce("subject", ''))) STORED;

CREATE INDEX "Letter_subjectFold_trgm_idx" ON "Letter" USING GIN ("subjectFold" gin_trgm_ops);

ALTER TABLE "Note"
  ADD COLUMN "bodyFold" text
  GENERATED ALWAYS AS (lower(coalesce("body", ''))) STORED;

CREATE INDEX "Note_bodyFold_trgm_idx" ON "Note" USING GIN ("bodyFold" gin_trgm_ops);

-- ─── Полнотекстовый поиск по задачам и документам ──────────────────────────

ALTER TABLE "Task"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('russian', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "Task_searchVector_idx" ON "Task" USING GIN ("searchVector");

ALTER TABLE "Task"
  ADD COLUMN "titleFold" text
  GENERATED ALWAYS AS (lower(coalesce("title", ''))) STORED;

CREATE INDEX "Task_titleFold_trgm_idx" ON "Task" USING GIN ("titleFold" gin_trgm_ops);

ALTER TABLE "Document"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('russian', coalesce("stateNote", '')), 'B')
  ) STORED;

CREATE INDEX "Document_searchVector_idx" ON "Document" USING GIN ("searchVector");

ALTER TABLE "Document"
  ADD COLUMN "titleFold" text
  GENERATED ALWAYS AS (lower(coalesce("title", ''))) STORED;

CREATE INDEX "Document_titleFold_trgm_idx" ON "Document" USING GIN ("titleFold" gin_trgm_ops);

-- ─── Календарь ─────────────────────────────────────────────────────────────
-- Единый источник дат для календарного представления. Отдельной таблицы
-- событий нет сознательно: дата живёт у своей сущности, и дублировать её
-- значит держать две правды и синхронизировать их.

CREATE VIEW "calendar_event" AS
  SELECT 'letter_due'::text      AS kind,
         l.id                    AS entity_id,
         l."projectId"           AS project_id,
         l."dueDate"             AS event_date,
         'Срок исполнения: ' || l."number" AS title,
         l."counterpartyId"      AS counterparty_id,
         (l.status NOT IN ('ANSWERED','SIGNED','NOTED','CLOSED_NO_ACTION')) AS is_open
  FROM "Letter" l WHERE l."dueDate" IS NOT NULL

  UNION ALL
  SELECT 'task_due', t.id, t."projectId", t."dueDate", t.title, t."counterpartyId",
         (s.category NOT IN ('DONE','CANCELLED'))
  FROM "Task" t
  JOIN "ProjectStatus" s ON s.id = t."statusId"
  WHERE t."dueDate" IS NOT NULL AND t."deletedAt" IS NULL

  UNION ALL
  SELECT 'task_planned_end', t.id, t."projectId", t."plannedEnd", t.title, t."counterpartyId",
         (s.category NOT IN ('DONE','CANCELLED'))
  FROM "Task" t
  JOIN "ProjectStatus" s ON s.id = t."statusId"
  WHERE t."plannedEnd" IS NOT NULL AND t."deletedAt" IS NULL

  UNION ALL
  SELECT 'milestone', m.id, m."projectId", m."dueDate", m.name, NULL,
         (m."reachedAt" IS NULL)
  FROM "Milestone" m

  UNION ALL
  SELECT 'integration_stage', cm.id, cm."projectId", cm."plannedDate", cm.stage, cm."counterpartyId",
         (cm."actualDate" IS NULL)
  FROM "CounterpartyMilestone" cm WHERE cm."plannedDate" IS NOT NULL

  UNION ALL
  SELECT 'document_integration_due', d.id, d."projectId", d."integrationDueDate", d.title, d."counterpartyId",
         (d.state NOT IN ('SIGNED','REJECTED','CANCELLED'))
  FROM "Document" d WHERE d."integrationDueDate" IS NOT NULL

  UNION ALL
  SELECT 'report_period_end', r.id, r."projectId", r."periodEnd",
         'Отчёт руководству', NULL, (r.state = 'DRAFT')
  FROM "StatusReport" r;

-- ─── Опора для аналитики ───────────────────────────────────────────────────
-- Состояние подписания документа по сторонам: из него считаются и воронка
-- подписания, и ответ на вопрос «на какой стороне документ стоит».

CREATE VIEW "document_signing_state" AS
  SELECT d.id                                                        AS document_id,
         d."projectId"                                               AS project_id,
         d.kind,
         d."counterpartyId"                                          AS counterparty_id,
         count(p.id)                                                 AS parties_total,
         count(p.id) FILTER (WHERE p.status = 'SIGNED')              AS parties_signed,
         count(p.id) FILTER (WHERE p.status = 'REFUSED')             AS parties_refused,
         count(p.id) FILTER (WHERE p.status IN ('NOT_SENT','SENT','UNDER_REVIEW','AGREED')) AS parties_pending,
         min(p."sentAt") FILTER (WHERE p.status <> 'NOT_SENT')       AS first_sent_at,
         max(p."signedAt")                                           AS last_signed_at
  FROM "Document" d
  LEFT JOIN "DocumentParty" p ON p."documentId" = d.id
  GROUP BY d.id, d."projectId", d.kind, d."counterpartyId";
