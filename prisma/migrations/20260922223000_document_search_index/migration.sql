-- Поисковая строка документа. Значения заполняет `npm run search:reindex`:
-- SQLite не приводит кириллицу к нижнему регистру, поэтому строку готовит
-- приложение. Команда входит в `npm run db:deploy`.
ALTER TABLE "Document" ADD COLUMN "searchIndex" TEXT;

CREATE INDEX "Document_searchIndex_idx" ON "Document"("searchIndex");
