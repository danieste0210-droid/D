-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('efectivo', 'yappy');

-- AlterEnum
ALTER TYPE "AwardStatus" ADD VALUE 'approved';

-- AlterEnum
ALTER TYPE "BetType" ADD VALUE 'chance3';

-- AlterEnum
ALTER TYPE "MatchType" ADD VALUE 'ultimas3';

-- AlterEnum: Palé pasa de 3 niveles (mayor/medio/menor) a 2 (mayor/menor) -- no había filas con
-- tier='medio' en producción al momento de esta migración, así que el cast directo es seguro.
BEGIN;
CREATE TYPE "PaletTier_new" AS ENUM ('mayor', 'menor');
ALTER TABLE "palet_multipliers" ALTER COLUMN "tier" TYPE "PaletTier_new" USING ("tier"::text::"PaletTier_new");
ALTER TYPE "PaletTier" RENAME TO "PaletTier_old";
ALTER TYPE "PaletTier_new" RENAME TO "PaletTier";
DROP TYPE "PaletTier_old";
COMMIT;

-- AlterTable
ALTER TABLE "awards" ADD COLUMN     "paid_by_id" TEXT,
ADD COLUMN     "payment_method" "PaymentMethod";

-- AlterTable
ALTER TABLE "lotteries" ADD COLUMN     "result_positions" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "results" ALTER COLUMN "second_number" DROP NOT NULL,
ALTER COLUMN "third_number" DROP NOT NULL;

-- CreateTable
CREATE TABLE "chance3_multipliers" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "multiplier" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chance3_multipliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chance3_multipliers_lottery_id_key" ON "chance3_multipliers"("lottery_id");

-- AddForeignKey
ALTER TABLE "chance3_multipliers" ADD CONSTRAINT "chance3_multipliers_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
