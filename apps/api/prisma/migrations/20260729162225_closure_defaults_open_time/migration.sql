-- AlterTable
ALTER TABLE "closures" ADD COLUMN     "open_time" TEXT;

-- CreateTable
CREATE TABLE "closure_defaults" (
    "id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" TEXT,
    "close_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closure_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closure_defaults_day_of_week_key" ON "closure_defaults"("day_of_week");

