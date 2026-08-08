-- Add indexes for the high-use list, dashboard, report, and relation lookups.
-- This migration is additive and does not rewrite business data.
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt" DESC);

CREATE INDEX "SalesOrder_createdAt_idx" ON "SalesOrder"("createdAt" DESC);
CREATE INDEX "SalesOrder_status_createdAt_idx" ON "SalesOrder"("status", "createdAt" DESC);
CREATE INDEX "SalesOrder_platform_createdAt_idx" ON "SalesOrder"("platform", "createdAt" DESC);

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate" DESC);
CREATE INDEX "Expense_category_expenseDate_idx" ON "Expense"("category", "expenseDate" DESC);

CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt" DESC);
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt" DESC);
