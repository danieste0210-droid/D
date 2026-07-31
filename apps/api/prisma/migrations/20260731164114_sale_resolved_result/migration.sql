-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "resolved_result_id" TEXT;

-- CreateIndex
CREATE INDEX "sales_resolved_result_id_idx" ON "sales"("resolved_result_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_resolved_result_id_fkey" FOREIGN KEY ("resolved_result_id") REFERENCES "results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
