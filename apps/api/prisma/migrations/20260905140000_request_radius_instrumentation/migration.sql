-- AlterTable
-- Radius instrumentation recorded at post time (AUC-95), feeding the day-30
-- decision on whether 5 km stays fixed, auto-expands, or becomes adjustable.
--
-- in_radius_shop_count is the count BEFORE category narrowing, where
-- matched_shop_count is after it. Kept apart because a zero-reach request has
-- three causes with opposite fixes — nobody in radius (widen), nobody in radius
-- mapped to the product (fix the catalogue), or everybody nearby suspended or
-- unfunded (billing) — and once summed they are indistinguishable.
--
-- All nullable: rows created before this migration have an *unknown* radius and
-- unknown exclusion split. Backfilling them with the current default would
-- fabricate observations, and the whole point of the ticket is to decide on
-- observed data rather than assumption.
ALTER TABLE "requests" ADD COLUMN     "match_radius_km" DOUBLE PRECISION,
ADD COLUMN     "in_radius_shop_count" INTEGER,
ADD COLUMN     "excluded_suspended_count" INTEGER,
ADD COLUMN     "excluded_insufficient_balance_count" INTEGER,
ADD COLUMN     "balance_enforced" BOOLEAN;
