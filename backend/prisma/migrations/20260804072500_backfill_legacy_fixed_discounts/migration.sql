-- Before typed discounts, the only supported manual-order discount was a
-- fixed amount stored in SalesOrder.discount. Preserve that known intent.
UPDATE "SalesOrder"
SET
  "discountType" = 'FIXED',
  "discountValue" = ROUND("discount"::numeric, 2)::double precision
WHERE "discount" > 0;
