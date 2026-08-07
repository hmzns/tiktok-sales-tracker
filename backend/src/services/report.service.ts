import prisma from "../lib/prisma";
import {
  allocateDiscountCents,
  fromMoneyCents,
  roundMoney,
  toMoneyCents,
} from "../utils/orderFinancials";
import {
  addBusinessDays,
  BUSINESS_TIME_ZONE,
  formatBusinessDate,
  getMonthRange,
  parseBusinessDate,
} from "../utils/reportDates";
import { getRecognizedOrderFinancials } from "../utils/tiktokAccounting";

type MonthlyReportFilter = {
  year?: number;
  month?: number;
};

type ReportFinancialItem = {
  quantity: number;
  sellPrice: number;
  costPrice: number;
  allocatedDiscount: number | null;
};

const getOrderItemFinancials = (
  items: ReportFinancialItem[],
  orderDiscount: number
) => {
  const grossRevenueCents = items.map((item) =>
    toMoneyCents(item.quantity * item.sellPrice)
  );
  const hasStoredAllocation = items.every(
    (item) => item.allocatedDiscount != null
  );
  let discountCents: number[];

  if (hasStoredAllocation) {
    discountCents = items.map((item, index) =>
      Math.min(
        grossRevenueCents[index],
        Math.max(0, toMoneyCents(item.allocatedDiscount ?? 0))
      )
    );
  } else {
    const grossSubtotalCents = grossRevenueCents.reduce(
      (sum, lineAmount) => sum + lineAmount,
      0
    );
    const legacyDiscountCents = Math.min(
      grossSubtotalCents,
      Math.max(0, toMoneyCents(orderDiscount))
    );

    discountCents =
      grossSubtotalCents > 0
        ? allocateDiscountCents(grossRevenueCents, legacyDiscountCents)
        : grossRevenueCents.map(() => 0);
  }

  return items.map((item, index) => ({
    grossRevenueCents: grossRevenueCents[index],
    discountCents: discountCents[index],
    productCostCents: toMoneyCents(item.quantity * item.costPrice),
  }));
};

export const getMonthlySalesReport = async (
  filter: MonthlyReportFilter
) => {
  const { year, month, startDate, endDate } = getMonthRange(
    filter.year,
    filter.month
  );

  // Financial reports recognize only item-confirmed orders that remain valid.
  const orders = await prisma.salesOrder.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
      status: "COMPLETED",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      orderNumber: true,
      source: true,
      platform: true,
      status: true,
      customerName: true,
      createdAt: true,
      subtotal: true,
      discount: true,
      shippingFee: true,
      total: true,
      totalCost: true,
      profit: true,
      tiktokPaymentMode: true,
      financeStatus: true,
      tiktokSettlementAmount: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          sellPrice: true,
          costPrice: true,
          lineTotal: true,
          allocatedDiscount: true,
          lineCost: true,
          lineProfit: true,
          product: {
            select: {
              name: true,
              sku: true,
              isActive: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const expenses = await prisma.expense.findMany({
    where: {
      expenseDate: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: {
      expenseDate: "asc",
    },
  });

  const accountingByOrderId = new Map(
    orders.map((order) => [
      order.id,
      getRecognizedOrderFinancials({
        source: order.source,
        paymentMode: order.tiktokPaymentMode,
        financeStatus: order.financeStatus,
        settlementAmount: order.tiktokSettlementAmount,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        totalCost: order.totalCost,
        profit: order.profit,
        items: order.items,
      }),
    ])
  );
  const recognizedAccounting = Array.from(accountingByOrderId.values()).filter(
    (financials) => !financials.pending
  );
  const totalRevenue = recognizedAccounting.reduce(
    (sum, financials) => sum + (financials.revenue ?? 0),
    0
  );
  const totalCost = recognizedAccounting.reduce(
    (sum, financials) => sum + (financials.cost ?? 0),
    0
  );
  const salesProfit = recognizedAccounting.reduce(
    (sum, financials) => sum + (financials.profit ?? 0),
    0
  );
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const netProfit = salesProfit - totalExpenses;

  const totalOrders = orders.length;
  const pendingFinanceOrderCount = Array.from(
    accountingByOrderId.values()
  ).filter((financials) => financials.pending).length;

  const totalItemsSold = orders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    );
  }, 0);

  const averageOrderValue =
    recognizedAccounting.length > 0
      ? totalRevenue / recognizedAccounting.length
      : 0;

  const orderRows = orders.map((order) => {
    const accounting = accountingByOrderId.get(order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      platform: order.platform,
      status: order.status,
      customerName: order.customerName,
      date: order.createdAt,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      total: accounting?.revenue ?? null,
      totalCost: accounting?.cost ?? null,
      profit: accounting?.profit ?? null,
      financePending: accounting?.pending ?? false,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        category: item.product.category?.name ?? null,
        quantity: item.quantity,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        lineTotal: item.lineTotal,
        lineCost: item.lineCost,
        lineProfit: item.lineProfit,
      })),
    };
  });

  // Collapse snapshot line-item values into one performance row per product.
  // OrderItem prices and costs are captured at sale time, so later Product
  // price changes do not rewrite historical revenue or gross profit.
  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      sku: string;
      category: string | null;
      isActive: boolean;
      unitsSold: number;
      grossRevenueCents: number;
      discountCents: number;
      productCostCents: number;
      orderIds: Set<string>;
      financeExcludedOrderIds: Set<string>;
      financeExcludedUnits: number;
    }
  >();

  for (const order of orders) {
    const itemFinancials = getOrderItemFinancials(order.items, order.discount);
    const excludeFullTikTokFinancials =
      order.source === "TIKTOK" &&
      order.tiktokPaymentMode === "FULL_TIKTOK";

    for (const [itemIndex, item] of order.items.entries()) {
      const existing = productMap.get(item.productId);
      const itemGrossRevenueCents =
        excludeFullTikTokFinancials
          ? 0
          : itemFinancials[itemIndex].grossRevenueCents;
      const itemDiscountCents = excludeFullTikTokFinancials
        ? 0
        : itemFinancials[itemIndex].discountCents;
      const itemCostCents = excludeFullTikTokFinancials
        ? 0
        : itemFinancials[itemIndex].productCostCents;

      if (existing) {
        existing.unitsSold += item.quantity;
        existing.grossRevenueCents += itemGrossRevenueCents;
        existing.discountCents += itemDiscountCents;
        existing.productCostCents += itemCostCents;
        existing.orderIds.add(order.id);
        if (excludeFullTikTokFinancials) {
          existing.financeExcludedOrderIds.add(order.id);
          existing.financeExcludedUnits += item.quantity;
        }
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku,
          category: item.product.category?.name ?? null,
          isActive: item.product.isActive,
          unitsSold: item.quantity,
          grossRevenueCents: itemGrossRevenueCents,
          discountCents: itemDiscountCents,
          productCostCents: itemCostCents,
          orderIds: new Set([order.id]),
          financeExcludedOrderIds: new Set(
            excludeFullTikTokFinancials ? [order.id] : []
          ),
          financeExcludedUnits: excludeFullTikTokFinancials
            ? item.quantity
            : 0,
        });
      }
    }
  }

  const productPerformanceRows = Array.from(productMap.values())
    .map((product) => {
      const netRevenueCents =
        product.grossRevenueCents - product.discountCents;
      const grossProfitCents = netRevenueCents - product.productCostCents;
      const netRevenue = fromMoneyCents(netRevenueCents);
      const grossProfit = fromMoneyCents(grossProfitCents);

      return {
        productId: product.productId,
        name: product.productName,
        sku: product.sku,
        isActive: product.isActive,
        unitsSold: product.unitsSold,
        orderCount: product.orderIds.size,
        financeExcludedOrderCount: product.financeExcludedOrderIds.size,
        financeExcludedUnits: product.financeExcludedUnits,
        grossRevenue: fromMoneyCents(product.grossRevenueCents),
        discountAmount: fromMoneyCents(product.discountCents),
        netRevenue,
        averageSellingPrice:
          product.unitsSold > 0
            ? netRevenue / product.unitsSold
            : 0,
        grossProfit,
        profitMargin:
          netRevenue !== 0
            ? (grossProfit / netRevenue) * 100
            : null,
      };
    })
    .sort(
      (a, b) =>
        b.unitsSold - a.unitsSold ||
        b.netRevenue - a.netRevenue ||
        a.name.localeCompare(b.name)
    );

  // Preserve the existing Overview payload while sourcing it from the same
  // snapshot-based product calculation used by Product Performance.
  const productSummary = productPerformanceRows.map((product) => ({
    productId: product.productId,
    productName: product.name,
    sku: product.sku,
    category: productMap.get(product.productId)?.category ?? null,
    quantitySold: product.unitsSold,
    revenue: product.netRevenue,
    cost: fromMoneyCents(
      productMap.get(product.productId)?.productCostCents ?? 0
    ),
    profit: product.grossProfit,
    financeExcludedOrderCount: product.financeExcludedOrderCount,
    financeExcludedUnits: product.financeExcludedUnits,
  }));

  const productPerformanceSummary = productPerformanceRows.reduce(
    (summary, product) => {
      summary.unitsSold += product.unitsSold;
      summary.grossRevenue = roundMoney(
        summary.grossRevenue + product.grossRevenue
      );
      summary.discountAmount = roundMoney(
        summary.discountAmount + product.discountAmount
      );
      summary.netRevenue = roundMoney(
        summary.netRevenue + product.netRevenue
      );
      summary.grossProfit = roundMoney(
        summary.grossProfit + product.grossProfit
      );
      summary.financeExcludedUnits += product.financeExcludedUnits;
      return summary;
    },
    {
      productCount: productPerformanceRows.length,
      unitsSold: 0,
      grossRevenue: 0,
      discountAmount: 0,
      netRevenue: 0,
      grossProfit: 0,
      financeExcludedUnits: 0,
    }
  );
  const financeExcludedOrderCount = orders.filter(
    (order) =>
      order.source === "TIKTOK" &&
      order.tiktokPaymentMode === "FULL_TIKTOK"
  ).length;

  const bestSellingProduct = productPerformanceRows[0] ?? null;
  const highestRevenueProduct =
    [...productPerformanceRows].sort(
      (a, b) =>
        b.netRevenue - a.netRevenue ||
        b.unitsSold - a.unitsSold ||
        a.name.localeCompare(b.name)
    )[0] ?? null;

  const expenseRows = expenses.map((expense) => ({
    expenseId: expense.id,
    title: expense.title,
    category: expense.category,
    amount: expense.amount,
    description: expense.description,
    expenseDate: expense.expenseDate,
  }));

  const expenseCategoryMap = new Map<
    string,
    {
      category: string;
      amount: number;
    }
  >();

  for (const expense of expenses) {
    const existing = expenseCategoryMap.get(expense.category);

    if (existing) {
      existing.amount += expense.amount;
    } else {
      expenseCategoryMap.set(expense.category, {
        category: expense.category,
        amount: expense.amount,
      });
    }
  }

  const expensesByCategory = Array.from(expenseCategoryMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  return {
    reportType: "MONTHLY_SALES_REPORT",
    period: {
      year,
      month,
      startDate,
      endDate,
    },
    summary: {
      totalRevenue,
      totalCost,
      salesProfit,
      totalExpenses,
      netProfit,
      totalOrders,
      totalItemsSold,
      averageOrderValue,
      pendingFinanceOrderCount,
      financiallyRecognizedOrderCount: recognizedAccounting.length,
    },
    orderRows,
    productSummary,
    productPerformance: {
      profitAccuracy: "HISTORICAL_ORDER_ITEM_COST" as const,
      financeAllocation:
        "FULL_TIKTOK_ORDER_FINANCE_EXCLUDED_FROM_PRODUCT_METRICS" as const,
      summary: {
        ...productPerformanceSummary,
        financeExcludedOrderCount,
      },
      highlights: {
        bestSellingProduct: bestSellingProduct
          ? {
              productId: bestSellingProduct.productId,
              name: bestSellingProduct.name,
              sku: bestSellingProduct.sku,
              unitsSold: bestSellingProduct.unitsSold,
            }
          : null,
        highestRevenueProduct: highestRevenueProduct
          ? {
              productId: highestRevenueProduct.productId,
              name: highestRevenueProduct.name,
              sku: highestRevenueProduct.sku,
              netRevenue: highestRevenueProduct.netRevenue,
            }
          : null,
      },
      products: productPerformanceRows,
    },
    expenseRows,
    expensesByCategory,
  };
};

type SalesTrendsFilter = {
  startDate: string;
  endDate: string;
};

type DailyTrendAccumulator = {
  date: string;
  orderCount: number;
  unitsSold: number;
  grossRevenueCents: number;
  discountCents: number;
  productCostCents: number;
  expenseCents: number;
  pendingFinanceOrderCount: number;
};

export const getSalesTrendsReport = async (filter: SalesTrendsFilter) => {
  const startDate = parseBusinessDate(filter.startDate);
  const inclusiveEndDate = parseBusinessDate(filter.endDate);

  if (!startDate || !inclusiveEndDate) {
    throw new Error("Sales trends received an invalid date range");
  }

  const endDate = addBusinessDays(inclusiveEndDate, 1);
  const [orders, expenses] = await Promise.all([
    prisma.salesOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
        status: "COMPLETED",
        items: {
          some: {},
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        createdAt: true,
        source: true,
        tiktokPaymentMode: true,
        financeStatus: true,
        tiktokSettlementAmount: true,
        subtotal: true,
        discount: true,
        total: true,
        totalCost: true,
        profit: true,
        items: {
          select: {
            quantity: true,
            sellPrice: true,
            costPrice: true,
            allocatedDiscount: true,
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: {
        expenseDate: "asc",
      },
      select: {
        amount: true,
        expenseDate: true,
      },
    }),
  ]);

  const dailyMap = new Map<string, DailyTrendAccumulator>();

  for (
    let cursor = new Date(startDate);
    cursor < endDate;
    cursor = addBusinessDays(cursor, 1)
  ) {
    const date = formatBusinessDate(cursor);
    dailyMap.set(date, {
      date,
      orderCount: 0,
      unitsSold: 0,
      grossRevenueCents: 0,
      discountCents: 0,
      productCostCents: 0,
      expenseCents: 0,
      pendingFinanceOrderCount: 0,
    });
  }

  for (const order of orders) {
    if (order.items.length === 0) {
      continue;
    }

    const daily = dailyMap.get(formatBusinessDate(order.createdAt));

    if (!daily) {
      continue;
    }

    daily.orderCount += 1;
    daily.unitsSold += order.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if (
      order.source === "TIKTOK" &&
      order.tiktokPaymentMode === "FULL_TIKTOK"
    ) {
      const accounting = getRecognizedOrderFinancials({
        source: order.source,
        paymentMode: order.tiktokPaymentMode,
        financeStatus: order.financeStatus,
        settlementAmount: order.tiktokSettlementAmount,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        totalCost: order.totalCost,
        profit: order.profit,
        items: order.items,
      });

      if (accounting.pending) {
        daily.pendingFinanceOrderCount += 1;
        continue;
      }

      daily.grossRevenueCents += toMoneyCents(accounting.revenue ?? 0);
      daily.productCostCents += toMoneyCents(accounting.cost ?? 0);
      continue;
    }

    const itemFinancials = getOrderItemFinancials(order.items, order.discount);

    for (const [index, item] of order.items.entries()) {
      const financials = itemFinancials[index];
      daily.grossRevenueCents += financials.grossRevenueCents;
      daily.discountCents += financials.discountCents;
      daily.productCostCents += financials.productCostCents;
    }

    // Keep Sales Trends on its existing tracker-product basis for external
    // product payments. TikTok settlement integration here is intentionally
    // deferred until real Seller Center settlements have been reconciled.
  }

  for (const expense of expenses) {
    const daily = dailyMap.get(formatBusinessDate(expense.expenseDate));

    if (daily) {
      daily.expenseCents += toMoneyCents(expense.amount);
    }
  }

  const trends = Array.from(dailyMap.values()).map((daily) => {
    const netRevenueCents =
      daily.grossRevenueCents - daily.discountCents;
    const grossProfitCents = netRevenueCents - daily.productCostCents;
    const netProfitCents = grossProfitCents - daily.expenseCents;

    return {
      date: daily.date,
      orderCount: daily.orderCount,
      unitsSold: daily.unitsSold,
      grossRevenue: fromMoneyCents(daily.grossRevenueCents),
      discountAmount: fromMoneyCents(daily.discountCents),
      netRevenue: fromMoneyCents(netRevenueCents),
      productCost: fromMoneyCents(daily.productCostCents),
      grossProfit: fromMoneyCents(grossProfitCents),
      expenses: fromMoneyCents(daily.expenseCents),
      netProfit: fromMoneyCents(netProfitCents),
      pendingFinanceOrderCount: daily.pendingFinanceOrderCount,
    };
  });

  const summary = trends.reduce(
    (totals, daily) => {
      totals.orderCount += daily.orderCount;
      totals.unitsSold += daily.unitsSold;
      totals.grossRevenueCents += toMoneyCents(daily.grossRevenue);
      totals.discountCents += toMoneyCents(daily.discountAmount);
      totals.productCostCents += toMoneyCents(daily.productCost);
      totals.expenseCents += toMoneyCents(daily.expenses);
      totals.pendingFinanceOrderCount += daily.pendingFinanceOrderCount;
      return totals;
    },
    {
      orderCount: 0,
      unitsSold: 0,
      grossRevenueCents: 0,
      discountCents: 0,
      productCostCents: 0,
      expenseCents: 0,
      pendingFinanceOrderCount: 0,
    }
  );
  const netRevenueCents =
    summary.grossRevenueCents - summary.discountCents;
  const grossProfitCents = netRevenueCents - summary.productCostCents;

  return {
    reportType: "SALES_TRENDS_REPORT",
    timezone: BUSINESS_TIME_ZONE,
    profitAccuracy: "HISTORICAL_ORDER_ITEM_COST" as const,
    financeAccounting:
      "TIKTOK_SETTLEMENT_RECOGNIZED_AT_ORDER_LEVEL" as const,
    period: {
      startDate: filter.startDate,
      endDate: filter.endDate,
    },
    summary: {
      orderCount: summary.orderCount,
      unitsSold: summary.unitsSold,
      grossRevenue: fromMoneyCents(summary.grossRevenueCents),
      discountAmount: fromMoneyCents(summary.discountCents),
      netRevenue: fromMoneyCents(netRevenueCents),
      productCost: fromMoneyCents(summary.productCostCents),
      grossProfit: fromMoneyCents(grossProfitCents),
      expenses: fromMoneyCents(summary.expenseCents),
      netProfit: fromMoneyCents(grossProfitCents - summary.expenseCents),
      pendingFinanceOrderCount: summary.pendingFinanceOrderCount,
    },
    trends,
  };
};
