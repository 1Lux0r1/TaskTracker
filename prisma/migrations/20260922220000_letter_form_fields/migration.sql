-- Форма письма стала разной для входящего и исходящего: у входящего резолюция,
-- у исходящего подписант. Дубль письма определяется парой «номер + дата».

ALTER TABLE "Letter" ADD COLUMN "resolution" TEXT;
ALTER TABLE "Letter" ADD COLUMN "signatory" TEXT;

DROP INDEX "Letter_projectId_number_direction_key";
CREATE UNIQUE INDEX "Letter_projectId_number_direction_date_key" ON "Letter"("projectId", "number", "direction", "date");
