-- DropIndex
DROP INDEX "sales_ticket_code_key";

-- AlterTable: agregar batch_id nullable primero para poder rellenar las filas existentes
-- (cada venta ya creada pasa a ser su propio lote de una sola línea, usando su propio id).
ALTER TABLE "sales" ADD COLUMN     "batch_id" TEXT;

UPDATE "sales" SET "batch_id" = "id" WHERE "batch_id" IS NULL;

ALTER TABLE "sales" ALTER COLUMN "batch_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "sales_batch_id_idx" ON "sales"("batch_id");
