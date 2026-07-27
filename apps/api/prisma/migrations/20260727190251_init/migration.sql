-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super', 'admin', 'supervisor', 'vendedor');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('active', 'cancelled', 'paid');

-- CreateEnum
CREATE TYPE "AwardStatus" AS ENUM ('pending', 'paid', 'reversed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "supervisor_id" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_label" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "refresh_token" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotteries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "max_amount_per_number" DECIMAL(12,2),
    "payout_multiplier" DECIMAL(6,2) NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closures" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "close_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lottery_schedule_changes" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_schedule_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "number_played" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "ticket_code" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "draw_date" TIMESTAMP(3) NOT NULL,
    "winning_number" TEXT NOT NULL,
    "processed_by_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "AwardStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_key" ON "user_sessions"("refresh_token");

-- CreateIndex
CREATE UNIQUE INDEX "closures_lottery_id_day_of_week_key" ON "closures"("lottery_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "sales_ticket_code_key" ON "sales"("ticket_code");

-- CreateIndex
CREATE INDEX "sales_seller_id_created_at_idx" ON "sales"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_lottery_id_created_at_idx" ON "sales"("lottery_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "results_lottery_id_draw_date_key" ON "results"("lottery_id", "draw_date");

-- CreateIndex
CREATE UNIQUE INDEX "awards_sale_id_key" ON "awards"("sale_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closures" ADD CONSTRAINT "closures_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_schedule_changes" ADD CONSTRAINT "lottery_schedule_changes_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_schedule_changes" ADD CONSTRAINT "lottery_schedule_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
