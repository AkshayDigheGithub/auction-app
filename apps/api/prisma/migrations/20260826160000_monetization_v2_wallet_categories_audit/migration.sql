-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('recharge', 'deal_fee', 'reversal', 'bonus', 'admin_credit', 'admin_debit', 'trial_waiver');

-- CreateEnum
CREATE TYPE "DealFeeStatus" AS ENUM ('shadow', 'waived_trial', 'charged', 'reversed');

-- CreateEnum
CREATE TYPE "ReversalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShopCategory" ADD VALUE 'computers';
ALTER TYPE "ShopCategory" ADD VALUE 'appliances';
ALTER TYPE "ShopCategory" ADD VALUE 'hardware';
ALTER TYPE "ShopCategory" ADD VALUE 'auto_parts';
ALTER TYPE "ShopCategory" ADD VALUE 'furniture';
ALTER TYPE "ShopCategory" ADD VALUE 'apparel';
ALTER TYPE "ShopCategory" ADD VALUE 'jewellery';
ALTER TYPE "ShopCategory" ADD VALUE 'grocery';

-- AlterTable
-- Add the new fee columns BEFORE dropping the old commission ones, so the
-- existing rows can be carried across rather than lost.
ALTER TABLE "deals"
ADD COLUMN     "fee_amount_paise" INTEGER,
ADD COLUMN     "fee_cap_paise" INTEGER,
ADD COLUMN     "fee_category" "ShopCategory",
ADD COLUMN     "fee_rate_bps" INTEGER,
ADD COLUMN     "fee_status" "DealFeeStatus" NOT NULL DEFAULT 'shadow';

-- Data migration: preserve what the old flat-2% model recorded.
--   commission_amount (rupees, Decimal) -> fee_amount_paise (integer paise)
--   commission_status 'paid'            -> fee_status 'charged'
--   commission_status 'pending'         -> fee_status 'shadow' (never actually collected)
-- fee_rate_bps is set to 200 (the old hardcoded 2%) so historical rows stay
-- interpretable next to rows priced under the new per-category rates.
-- fee_category is backfilled from the shop's category, which is the same
-- category the new pricing would have used.
UPDATE "deals" d
SET "fee_amount_paise" = ROUND(d."commission_amount" * 100)::INTEGER,
    "fee_rate_bps"     = 200,
    "fee_category"     = s."category"
FROM "shops" s
WHERE s."id" = d."shop_id"
  AND d."commission_amount" IS NOT NULL;

UPDATE "deals"
SET "fee_status" = 'charged'
WHERE "commission_status" = 'paid';

ALTER TABLE "deals" DROP COLUMN "commission_amount",
DROP COLUMN "commission_status";

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "product_category_id" TEXT;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "free_deals_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "secondary_categories" "ShopCategory"[] DEFAULT ARRAY[]::"ShopCategory"[],
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspended_reason" TEXT,
ADD COLUMN     "wallet_balance_paise" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "CommissionStatus";

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "balance_after_paise" INTEGER NOT NULL,
    "deal_id" TEXT,
    "reason" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rates" (
    "category" "ShopCategory" NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "cap_paise" INTEGER,
    "floor_paise" INTEGER NOT NULL DEFAULT 2000,
    "flat_fee_paise" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "shop_categories" "ShopCategory"[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_reversals" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "reported_by_user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReversalStatus" NOT NULL DEFAULT 'pending',
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_transactions_shop_id_created_at_idx" ON "wallet_transactions"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_created_at_idx" ON "wallet_transactions"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_parent_id_sort_order_idx" ON "product_categories"("parent_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "deal_reversals_deal_id_key" ON "deal_reversals"("deal_id");

-- CreateIndex
CREATE INDEX "deal_reversals_status_created_at_idx" ON "deal_reversals"("status", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_user_id_created_at_idx" ON "admin_audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "deals_shop_id_created_at_idx" ON "deals"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "deals_fee_status_idx" ON "deals"("fee_status");

-- CreateIndex
CREATE INDEX "requests_product_category_id_idx" ON "requests"("product_category_id");

-- CreateIndex
CREATE INDEX "shops_category_idx" ON "shops"("category");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_reversals" ADD CONSTRAINT "deal_reversals_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

