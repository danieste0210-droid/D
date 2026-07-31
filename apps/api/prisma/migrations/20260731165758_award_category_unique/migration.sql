-- DropIndex: (sale_id, position) ya no modela el invariante correcto -- una venta puede ganar
-- varias categorías a la vez en la misma posición, y puede volver a ganar ante un resultado
-- corregido tras una reversión.
DROP INDEX "awards_sale_id_position_key";

-- AlterTable: se agrega nullable primero para poder rellenar las filas existentes (datos de
-- prueba en desarrollo, no hay premios reales todavía).
ALTER TABLE "awards" ADD COLUMN     "category" TEXT;

UPDATE "awards" SET "category" = 'legacy' WHERE "category" IS NULL;

ALTER TABLE "awards" ALTER COLUMN "category" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "awards_sale_id_result_id_position_category_key" ON "awards"("sale_id", "result_id", "position", "category");
