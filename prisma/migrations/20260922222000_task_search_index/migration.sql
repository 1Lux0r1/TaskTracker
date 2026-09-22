-- Поисковая строка задачи: как у письма, готовится при записи, потому что
-- SQLite не приводит кириллицу к нижнему регистру в LIKE.
ALTER TABLE "Task" ADD COLUMN "searchIndex" TEXT;

CREATE INDEX "Task_searchIndex_idx" ON "Task"("searchIndex");

-- Заполняем по уже заведённым задачам: без этого поиск не нашёл бы ничего
-- из перенесённого из Excel.
UPDATE "Task"
SET "searchIndex" = lower(
  replace(
    trim(
      "title"
      || ' ' || coalesce("description", '')
      || ' ' || coalesce("progressNote", '')
      || ' ' || coalesce("externalTaskKey", '')
      || ' ' || coalesce("externalAssignee", '')
    ),
    'ё', 'е'
  )
);
