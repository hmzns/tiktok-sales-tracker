import prisma from "../lib/prisma";
import { getRecognizedOrderFinancials } from "../utils/tiktokAccounting";

type DashboardFilter = {
  year?: number;
  month?: number;
};

const getMonthRange = (year?: number, month?: number) => {
  const now = new Date();

  const selectedYear = year ?? now.getFullYear();
  const selectedMonth = month ?? now.getMonth() + 1;

  // Use a half-open range so every timestamp belongs to exactly one month.
  const startDate = new Date(selectedYear, selectedMonth - 1, 1);
  const endDate = new Date(selectedYear, selectedMonth, 1);

  return {
    year: selectedYear,
    month: selectedMonth,
    startDate,
    endDate,
  };
};

export const getDashboardSummary = async (filter: DashboardFilter) => {
  const { year, month, startDate, endDate } = getMonthRange(
    filter.year,
    filter.month
  );

  // Only item-confirmed, non-reversed orders contribute to sales metrics.
  const orders = await prisma.salesOrder.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
      status: "COMPLETED",
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
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
  const revenue = recognizedAccounting.reduce(
    (sum, financials) => sum + (financials.revenue ?? 0),
    0
  );
  const totalCost = recognizedAccounting.reduce(
    (sum, financials) => sum + (financials.cost ?? 0),
    0
  );
  const profit = recognizedAccounting.reduce(
    (sum, financials) => sum + (financials.profit ?? 0),
    0
  );
  const orderCount = orders.length;
  const pendingFinanceOrderCount = Array.from(
    accountingByOrderId.values()
  ).filter((financials) => financials.pending).length;

  const itemsSold = orders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    );
  }, 0);

  const averageOrderValue =
    recognizedAccounting.length > 0
      ? revenue / recognizedAccounting.length
      : 0;

  const expenses = await prisma.expense.findMany({
    where: {
      expenseDate: {
        gte: startDate,
        lt: endDate,
      },
    },
  });

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  const netProfit = profit - totalExpenses;

  const expensesByCategory = expenses.reduce((acc, expense) => {
    const existing = acc.find((item) => item.category === expense.category);

    if (existing) {
      existing.amount += expense.amount;
    } else {
      acc.push({
        category: expense.category,
        amount: expense.amount,
      });
    }

    return acc;
  }, [] as { category: string; amount: number }[]);

  const daysInMonth = new Date(year, month, 0).getDate();

  // Pre-fill every calendar day so chart consumers do not need to infer gaps.
  const dailySales = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;

    return {
      day,
      revenue: 0,
      profit: 0,
      orderCount: 0,
    };
  });

for (const order of orders) {
  const day = order.createdAt.getDate();
  const daily = dailySales[day - 1];

  const accounting = accountingByOrderId.get(order.id);
  if (!accounting?.pending) {
    daily.revenue += accounting?.revenue ?? 0;
    daily.profit += accounting?.profit ?? 0;
  }
  daily.orderCount += 1;
}

  const productMap = new Map<
    string,
    {
      productId: string;
      name: string;
      sku: string;
      quantitySold: number;
      revenue: number;
      profit: number;
      financeExcludedUnits: number;
    }
  >();

  for (const order of orders) {
    const excludeFullTikTokFinancials =
      order.source === "TIKTOK" &&
      order.tiktokPaymentMode === "FULL_TIKTOK";

    for (const item of order.items) {
      const existing = productMap.get(item.productId);
      const trackerNetLineRevenue = item.lineProfit + item.lineCost;

      if (existing) {
        existing.quantitySold += item.quantity;
        if (excludeFullTikTokFinancials) {
          existing.financeExcludedUnits += item.quantity;
        } else {
          existing.revenue += trackerNetLineRevenue;
          existing.profit += item.lineProfit;
        }
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          quantitySold: item.quantity,
          revenue: excludeFullTikTokFinancials ? 0 : trackerNetLineRevenue,
          profit: excludeFullTikTokFinancials ? 0 : item.lineProfit,
          financeExcludedUnits: excludeFullTikTokFinancials
            ? item.quantity
            : 0,
        });
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5);

  const lowStockProducts = await prisma.product.findMany({
    where: {
      stock: {
        lte: 5,
      },
      isActive: true,
    },
    orderBy: {
      stock: "asc",
    },
    take: 5,
  });

  const stockMovements = await prisma.stockMovement.findMany({
  where: {
    createdAt: {
      gte: startDate,
      lt: endDate,
    },
  },
});

const recentStockMovements = await prisma.stockMovement.findMany({
  orderBy: {
    createdAt: "desc",
  },
  take: 5,
  include: {
    product: true,
  },
});

const stockSummary = {
  restocked: 0,
  sold: 0,
  damaged: 0,
  restored: 0,
  manualIn: 0,
  manualOut: 0,
  totalStockIn: 0,
  totalStockOut: 0,
};

// Movement quantities are signed; outward-facing totals are kept positive.
for (const movement of stockMovements) {
  if (movement.quantity > 0) {
    stockSummary.totalStockIn += movement.quantity;
  }

  if (movement.quantity < 0) {
    stockSummary.totalStockOut += Math.abs(movement.quantity);
  }

  if (movement.type === "RESTOCK") {
    stockSummary.restocked += movement.quantity;
  }

  if (movement.type === "SALE") {
    stockSummary.sold += Math.abs(movement.quantity);
  }

  if (movement.type === "DAMAGE") {
    stockSummary.damaged += Math.abs(movement.quantity);
  }

  if (
    movement.type === "CANCEL_RESTORE" ||
    movement.type === "REFUND_RESTORE"
  ) {
    stockSummary.restored += movement.quantity;
  }

  if (movement.type === "MANUAL_IN") {
    stockSummary.manualIn += movement.quantity;
  }

  if (movement.type === "MANUAL_OUT") {
    stockSummary.manualOut += Math.abs(movement.quantity);
  }
}
  return {
    period: {
      year,
      month,
      startDate,
      endDate,
    },
    revenue,
    totalCost,
    profit,
    salesProfit: profit,
    totalExpenses,
    netProfit,
    orderCount,
    itemsSold,
    averageOrderValue,
    pendingFinanceOrderCount,
    financiallyRecognizedOrderCount: recognizedAccounting.length,
    topProducts,
    dailySales,
    expensesByCategory,
    lowStockProducts,
    stockSummary,
    recentStockMovements
  };
};
