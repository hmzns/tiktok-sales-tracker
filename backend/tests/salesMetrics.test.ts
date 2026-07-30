import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../src/lib/prisma";
import { getDashboardSummary } from "../src/services/dashboard.service";
import { getMonthlySalesReport } from "../src/services/report.service";

test("dashboard and monthly report query only READY sales orders", async () => {
  const originalSalesOrderFindMany = prisma.salesOrder.findMany;
  const originalExpenseFindMany = prisma.expense.findMany;
  const originalProductFindMany = prisma.product.findMany;
  const originalStockMovementFindMany = prisma.stockMovement.findMany;
  const salesOrderQueries: unknown[] = [];

  prisma.salesOrder.findMany = (async (args: unknown) => {
    salesOrderQueries.push(args);
    return [];
  }) as typeof prisma.salesOrder.findMany;
  prisma.expense.findMany = (async () => []) as typeof prisma.expense.findMany;
  prisma.product.findMany = (async () => []) as typeof prisma.product.findMany;
  prisma.stockMovement.findMany = (async () =>
    []) as typeof prisma.stockMovement.findMany;

  try {
    const dashboard = await getDashboardSummary({
      year: 2026,
      month: 7,
    });
    const report = await getMonthlySalesReport({
      year: 2026,
      month: 7,
    });

    assert.equal(dashboard.revenue, 0);
    assert.equal(dashboard.profit, 0);
    assert.equal(dashboard.orderCount, 0);
    assert.equal(report.summary.totalRevenue, 0);
    assert.equal(report.summary.salesProfit, 0);
    assert.equal(report.summary.totalOrders, 0);
    assert.equal(salesOrderQueries.length, 2);

    for (const query of salesOrderQueries) {
      assert.equal(
        (query as { where: { importStatus: string } }).where.importStatus,
        "READY"
      );
    }
  } finally {
    prisma.salesOrder.findMany = originalSalesOrderFindMany;
    prisma.expense.findMany = originalExpenseFindMany;
    prisma.product.findMany = originalProductFindMany;
    prisma.stockMovement.findMany = originalStockMovementFindMany;
  }
});
