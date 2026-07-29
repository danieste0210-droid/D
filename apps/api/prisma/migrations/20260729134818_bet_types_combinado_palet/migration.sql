-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('recto', 'combinado', 'palet');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('ultimas', 'primeras');

-- CreateEnum
CREATE TYPE "PaletTier" AS ENUM ('mayor', 'menor');

-- DropIndex
DROP INDEX "payout_multipliers_lottery_id_digit_count_position_key";

-- AlterTable
ALTER TABLE "payout_multipliers" ADD COLUMN     "match_type" "MatchType" NOT NULL DEFAULT 'ultimas';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "bet_type" "BetType" NOT NULL DEFAULT 'recto';

-- CreateTable
CREATE TABLE "combinado_multipliers" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "digit_count" INTEGER NOT NULL,
    "multiplier" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combinado_multipliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "palet_multipliers" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "tier" "PaletTier" NOT NULL,
    "multiplier" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "palet_multipliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "combinado_multipliers_lottery_id_digit_count_key" ON "combinado_multipliers"("lottery_id", "digit_count");

-- CreateIndex
CREATE UNIQUE INDEX "palet_multipliers_lottery_id_tier_key" ON "palet_multipliers"("lottery_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "payout_multipliers_lottery_id_digit_count_position_match_ty_key" ON "payout_multipliers"("lottery_id", "digit_count", "position", "match_type");

-- AddForeignKey
ALTER TABLE "combinado_multipliers" ADD CONSTRAINT "combinado_multipliers_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "palet_multipliers" ADD CONSTRAINT "palet_multipliers_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

