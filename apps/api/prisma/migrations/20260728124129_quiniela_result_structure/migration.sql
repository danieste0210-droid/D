-- DropIndex
DROP INDEX "awards_sale_id_key";

-- AlterTable
ALTER TABLE "awards" ADD COLUMN     "position" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "lotteries" DROP COLUMN "payout_multiplier";

-- AlterTable
ALTER TABLE "results" DROP COLUMN "winning_number",
ADD COLUMN     "first_number" TEXT NOT NULL,
ADD COLUMN     "second_number" TEXT NOT NULL,
ADD COLUMN     "third_number" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "commission_percent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "payout_multipliers" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "digit_count" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "multiplier" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_multipliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_numbers" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_multipliers_lottery_id_digit_count_position_key" ON "payout_multipliers"("lottery_id", "digit_count", "position");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_numbers_lottery_id_number_key" ON "blocked_numbers"("lottery_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "awards_sale_id_position_key" ON "awards"("sale_id", "position");

-- AddForeignKey
ALTER TABLE "payout_multipliers" ADD CONSTRAINT "payout_multipliers_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_numbers" ADD CONSTRAINT "blocked_numbers_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_numbers" ADD CONSTRAINT "blocked_numbers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

