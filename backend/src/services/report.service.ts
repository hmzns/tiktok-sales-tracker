import prisma from "../lib/prisma";
import {
  allocateDiscountCents,
  fromMoneyCents,
  roundMoney,
  toMoneyCents,
} from "../utils/orderFinancials";

type MonthlyReportFilter = {
  year?: number;
  month?: number;
};

const getMonthRange = (year?: number, month?: number) => {
  const now = new Date();

  const selectedYear = year ?? now.getFullYear();
  const selectedMonth = month ?? now.getMonth() + 1;

  // The exclusive end boundary avoids overlap between consecutive reports.
  const startDate = new Date(selectedYear, selectedMonth - 1, 1);
  const endDate = new Date(selectedYear, selectedMonth, 1);

  return {
    year: selectedYear,
    month: selectedMonth,
    startDate,
    endDate,
  };
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
      status: {
        notIn: ["CANCELLED", "REFUNDED"],
      },
      importStatus: "READY",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      orderNumber: true,
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

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalCost = orders.reduce((sum, order) => sum + order.totalCost, 0);
  const salesProfit = orders.reduce((sum, order) => sum + order.profit, 0);
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const netProfit = salesProfit - totalExpenses;

  const totalOrders = orders.length;

  const totalItemsSold = orders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    );
  }, 0);

  const averageOrderValue =
    totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const orderRows = orders.map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    platform: order.platform,
    status: order.status,
    customerName: order.customerName,
    date: order.createdAt,
    subtotal: order.subtotal,
    discount: order.discount,
    shippingFee: order.shippingFee,
    total: order.total,
    totalCost: order.totalCost,
    profit: order.profit,
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
  }));

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
    }
  >();

  for (const order of orders) {
    const lineGrossCents = order.items.map((item) =>
      toMoneyCents(item.quantity * item.sellPrice)
    );
    const hasStoredAllocation = order.items.every(
      (item) => item.allocatedDiscount != null
    );
    let orderAllocatedDiscountCents: number[];

    if (hasStoredAllocation) {
      orderAllocatedDiscountCents = order.items.map((item, index) =>
        Math.min(
          lineGrossCents[index],
          Math.max(0, toMoneyCents(item.allocatedDiscount ?? 0))
        )
      );
    } else {
      const grossSubtotalCents = lineGrossCents.reduce(
        (sum, lineAmount) => sum + lineAmount,
        0
      );
      const legacyDiscountCents = Math.min(
        grossSubtotalCents,
        Math.max(0, toMoneyCents(order.discount))
      );

      orderAllocatedDiscountCents =
        grossSubtotalCents > 0
          ? allocateDiscountCents(lineGrossCents, legacyDiscountCents)
          : lineGrossCents.map(() => 0);
    }

    for (const [itemIndex, item] of order.items.entries()) {
      const existing = productMap.get(item.productId);
      const itemGrossRevenueCents = lineGrossCents[itemIndex];
      const itemDiscountCents = orderAllocatedDiscountCents[itemIndex];
      const itemCostCents = toMoneyCents(item.quantity * item.costPrice);

      if (existing) {
        existing.unitsSold += item.quantity;
        existing.grossRevenueCents += itemGrossRevenueCents;
        existing.discountCents += itemDiscountCents;
        existing.productCostCents += itemCostCents;
        existing.orderIds.add(order.id);
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
      return summary;
    },
    {
      productCount: productPerformanceRows.length,
      unitsSold: 0,
      grossRevenue: 0,
      discountAmount: 0,
      netRevenue: 0,
      grossProfit: 0,
    }
  );

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
    },
    orderRows,
    productSummary,
    productPerformance: {
      profitAccuracy: "HISTORICAL_ORDER_ITEM_COST" as const,
      summary: productPerformanceSummary,
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
