-- Consolidate the public order lifecycle into one status column.
-- Incomplete TikTok imports remain actionable; every other non-reversed
-- legacy order is treated as completed.
CREATE TYPE "SalesOrderStatus_new" AS ENUM (
  'NEEDS_ITEMS',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED'
);

ALTER TABLE "SalesOrder" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "SalesOrder"
ALTER COLUMN "status" TYPE "SalesOrderStatus_new"
USING (
  CASE
    WHEN "source" = 'TIKTOK'
      AND ("importStatus" <> 'READY' OR "stockProcessed" = false)
      THEN 'NEEDS_ITEMS'
    WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'
    WHEN "status"::text = 'REFUNDED' THEN 'REFUNDED'
    ELSE 'COMPLETED'
  END
)::"SalesOrderStatus_new";

DROP TYPE "SalesOrderStatus";
ALTER TYPE "SalesOrderStatus_new" RENAME TO "SalesOrderStatus";

ALTER TABLE "SalesOrder"
  ALTER COLUMN "status" SET DEFAULT 'COMPLETED',
  DROP COLUMN "importStatus";

DROP TYPE "ImportStatus";
