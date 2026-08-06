import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../src/lib/prisma";
import { getDashboardSummary } from "../src/services/dashboard.service";
import {
  getMonthlySalesReport,
  getSalesTrendsReport,
} from "../src/services/report.service";

test("dashboard and monthly report query only completed sales orders", async () => {
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
        (query as { where: { status: string } }).where.status,
        "COMPLETED"
      );
    }
  } finally {
    prisma.salesOrder.findMany = originalSalesOrderFindMany;
    prisma.expense.findMany = originalExpenseFindMany;
    prisma.product.findMany = originalProductFindMany;
    prisma.stockMovement.findMany = originalStockMovementFindMany;
  }
});

test("monthly product performance uses stored item prices and distinct orders", async () => {
  const originalSalesOrderFindMany = prisma.salesOrder.findMany;
  const originalExpenseFindMany = prisma.expense.findMany;
  let reportQuery: unknown;

  const inactiveProduct = {
    name: "Archived Serum",
    sku: "SERUM-01",
    isActive: false,
    category: { name: "Skincare" },
  };
  const activeProduct = {
    name: "Lip Tint",
    sku: "LIP-02",
    isActive: true,
    category: null,
  };

  const orders = [
    {
      id: "order-1",
      orderNumber: "ORD-1",
      platform: "MANUAL",
      status: "COMPLETED",
      customerName: null,
      createdAt: new Date(2026, 6, 5),
      subtotal: 52,
      discount: 5,
      shippingFee: 0,
      total: 52,
      totalCost: 24,
      profit: 28,
      items: [
        {
          productId: "product-1",
          quantity: 2,
          sellPrice: 10,
          costPrice: 4,
          lineTotal: 20,
          allocatedDiscount: 2,
          lineCost: 8,
          lineProfit: 12,
          product: inactiveProduct,
        },
        {
          productId: "product-1",
          quantity: 1,
          sellPrice: 12,
          costPrice: 4,
          lineTotal: 12,
          allocatedDiscount: 1,
          lineCost: 4,
          lineProfit: 8,
          product: inactiveProduct,
        },
        {
          productId: "product-2",
          quantity: 1,
          sellPrice: 20,
          costPrice: 12,
          lineTotal: 20,
          allocatedDiscount: 2,
          lineCost: 12,
          lineProfit: 8,
          product: activeProduct,
        },
      ],
    },
    {
      id: "order-2",
      orderNumber: "ORD-2",
      platform: "TIKTOK_SHOP",
      status: "COMPLETED",
      customerName: null,
      createdAt: new Date(2026, 6, 8),
      subtotal: 27,
      discount: 3,
      shippingFee: 0,
      total: 27,
      totalCost: 15,
      profit: 12,
      items: [
        {
          productId: "product-1",
          quantity: 3,
          sellPrice: 9,
          costPrice: 5,
          lineTotal: 27,
          allocatedDiscount: null,
          lineCost: 15,
          lineProfit: 12,
          product: inactiveProduct,
        },
      ],
    },
  ];

  prisma.salesOrder.findMany = (async (args: unknown) => {
    reportQuery = args;
    return orders;
  }) as unknown as typeof prisma.salesOrder.findMany;
  prisma.expense.findMany = (async () => []) as typeof prisma.expense.findMany;

  try {
    const report = await getMonthlySalesReport({ year: 2026, month: 7 });
    const serum = report.productPerformance.products.find(
      (product) => product.productId === "product-1"
    );

    assert.ok(serum);
    assert.equal(serum.isActive, false);
    assert.equal(serum.unitsSold, 6);
    assert.equal(serum.orderCount, 2);
    assert.equal(serum.grossRevenue, 59);
    assert.equal(serum.discountAmount, 6);
    assert.equal(serum.netRevenue, 53);
    assert.equal(serum.grossProfit, 26);
    assert.ok(Math.abs(serum.averageSellingPrice - 53 / 6) < 1e-10);
    assert.ok(Math.abs((serum.profitMargin ?? 0) - (26 / 53) * 100) < 1e-10);

    assert.deepEqual(report.productPerformance.summary, {
      productCount: 2,
      unitsSold: 7,
      grossRevenue: 79,
      discountAmount: 8,
      netRevenue: 71,
      grossProfit: 32,
    });
    assert.equal(
      report.productPerformance.highlights.bestSellingProduct?.productId,
      "product-1"
    );
    assert.equal(
      report.productPerformance.highlights.highestRevenueProduct?.productId,
      "product-1"
    );
    assert.equal(
      report.productPerformance.profitAccuracy,
      "HISTORICAL_ORDER_ITEM_COST"
    );

    const query = reportQuery as {
      where: { status: string };
      select: Record<string, unknown>;
    };
    assert.equal(query.where.status, "COMPLETED");
    assert.equal("rawImportData" in query.select, false);
  } finally {
    prisma.salesOrder.findMany = originalSalesOrderFindMany;
    prisma.expense.findMany = originalExpenseFindMany;
  }
});

test("historical items without allocation and without discount keep gross revenue", async () => {
  const originalSalesOrderFindMany = prisma.salesOrder.findMany;
  const originalExpenseFindMany = prisma.expense.findMany;

  prisma.salesOrder.findMany = (async () => [
    {
      id: "legacy-order",
      orderNumber: "LEGACY-1",
      platform: "MANUAL",
      status: "COMPLETED",
      customerName: null,
      createdAt: new Date(2026, 6, 10),
      subtotal: 20,
      discount: 0,
      shippingFee: 0,
      total: 20,
      totalCost: 8,
      profit: 12,
      items: [
        {
          productId: "product-1",
          quantity: 2,
          sellPrice: 10,
          costPrice: 4,
          lineTotal: 20,
          allocatedDiscount: null,
          lineCost: 8,
          lineProfit: 12,
          product: {
            name: "Legacy Product",
            sku: "LEGACY-SKU",
            isActive: true,
            category: null,
          },
        },
      ],
    },
  ]) as unknown as typeof prisma.salesOrder.findMany;
  prisma.expense.findMany = (async () => []) as typeof prisma.expense.findMany;

  try {
    const report = await getMonthlySalesReport({ year: 2026, month: 7 });
    const product = report.productPerformance.products[0];

    assert.equal(product.grossRevenue, 20);
    assert.equal(product.discountAmount, 0);
    assert.equal(product.netRevenue, 20);
    assert.equal(product.grossProfit, 12);
  } finally {
    prisma.salesOrder.findMany = originalSalesOrderFindMany;
    prisma.expense.findMany = originalExpenseFindMany;
  }
});

test("sales trends allocate discounts, use historical cost, and include zero days", async () => {
  const originalSalesOrderFindMany = prisma.salesOrder.findMany;
  const originalExpenseFindMany = prisma.expense.findMany;
  let orderQuery: unknown;
  let expenseQuery: unknown;

  prisma.salesOrder.findMany = (async (args: unknown) => {
    orderQuery = args;
    return [
      {
        id: "stored-allocation-order",
        createdAt: new Date(2026, 7, 2, 0, 5),
        discount: 3,
        items: [
          {
            quantity: 2,
            sellPrice: 10,
            costPrice: 4,
            allocatedDiscount: 2,
          },
          {
            quantity: 1,
            sellPrice: 10,
            costPrice: 5,
            allocatedDiscount: 1,
          },
        ],
      },
      {
        id: "legacy-order",
        createdAt: new Date(2026, 7, 3, 13, 30),
        discount: 2,
        items: [
          {
            quantity: 1,
            sellPrice: 12,
            costPrice: 7,
            allocatedDiscount: null,
          },
        ],
      },
    ];
  }) as unknown as typeof prisma.salesOrder.findMany;
  prisma.expense.findMany = (async (args: unknown) => {
    expenseQuery = args;
    return [
      { amount: 5.25, expenseDate: new Date(2026, 7, 1, 9) },
      { amount: 2, expenseDate: new Date(2026, 7, 2, 18) },
    ];
  }) as unknown as typeof prisma.expense.findMany;

  try {
    const report = await getSalesTrendsReport({
      startDate: "2026-08-01",
      endDate: "2026-08-04",
    });

    assert.equal(report.timezone, "Asia/Kuching");
    assert.equal(report.profitAccuracy, "HISTORICAL_ORDER_ITEM_COST");
    assert.equal(report.trends.length, 4);
    assert.deepEqual(report.trends[0], {
      date: "2026-08-01",
      orderCount: 0,
      unitsSold: 0,
      grossRevenue: 0,
      discountAmount: 0,
      netRevenue: 0,
      productCost: 0,
      grossProfit: 0,
      expenses: 5.25,
      netProfit: -5.25,
    });
    assert.deepEqual(report.trends[1], {
      date: "2026-08-02",
      orderCount: 1,
      unitsSold: 3,
      grossRevenue: 30,
      discountAmount: 3,
      netRevenue: 27,
      productCost: 13,
      grossProfit: 14,
      expenses: 2,
      netProfit: 12,
    });
    assert.deepEqual(report.trends[2], {
      date: "2026-08-03",
      orderCount: 1,
      unitsSold: 1,
      grossRevenue: 12,
      discountAmount: 2,
      netRevenue: 10,
      productCost: 7,
      grossProfit: 3,
      expenses: 0,
      netProfit: 3,
    });
    assert.equal(report.trends[3].orderCount, 0);
    assert.deepEqual(report.summary, {
      orderCount: 2,
      unitsSold: 4,
      grossRevenue: 42,
      discountAmount: 5,
      netRevenue: 37,
      productCost: 20,
      grossProfit: 17,
      expenses: 7.25,
      netProfit: 9.75,
    });

    const salesQuery = orderQuery as {
      where: {
        status: string;
        items: { some: Record<string, never> };
      };
      select: Record<string, unknown>;
    };
    assert.equal(salesQuery.where.status, "COMPLETED");
    assert.deepEqual(salesQuery.where.items, { some: {} });
    assert.equal("customerName" in salesQuery.select, false);
    assert.equal("rawImportData" in salesQuery.select, false);

    const costsQuery = expenseQuery as { select: Record<string, unknown> };
    assert.deepEqual(costsQuery.select, {
      amount: true,
      expenseDate: true,
    });
  } finally {
    prisma.salesOrder.findMany = originalSalesOrderFindMany;
    prisma.expense.findMany = originalExpenseFindMany;
  }
});
