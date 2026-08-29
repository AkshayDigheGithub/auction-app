-- CreateEnum
CREATE TYPE "DisputeParty" AS ENUM ('customer', 'shop_owner');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('bid_not_honoured', 'price_higher_in_shop', 'item_not_available', 'shop_unreachable', 'customer_no_show', 'conduct', 'other');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'upheld', 'dismissed');

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "raised_by_user_id" TEXT NOT NULL,
    "raised_by_party" "DisputeParty" NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "details" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disputes_status_created_at_idx" ON "disputes"("status", "created_at");

-- CreateIndex
CREATE INDEX "disputes_shop_id_status_idx" ON "disputes"("shop_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_deal_id_raised_by_user_id_key" ON "disputes"("deal_id", "raised_by_user_id");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_user_id_fkey" FOREIGN KEY ("raised_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
