-- AlterTable
ALTER TABLE "Letter" ADD COLUMN "searchIndex" TEXT;

-- CreateIndex
CREATE INDEX "Letter_searchIndex_idx" ON "Letter"("searchIndex");
