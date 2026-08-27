-- AlterTable
-- Match outcome recorded at post time (AUC-59). Both nullable: rows created
-- before this migration have an *unknown* reach, which is not the same as a
-- zero reach and must not show up in the "reached nobody" admin filter.
ALTER TABLE "requests" ADD COLUMN     "matched_shop_count" INTEGER,
ADD COLUMN     "notified_shop_count" INTEGER;

-- CreateIndex
CREATE INDEX "requests_notified_shop_count_idx" ON "requests"("notified_shop_count");
