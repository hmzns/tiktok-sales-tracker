import prisma from "../lib/prisma";

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

  // Cancelled and refunded orders no longer contribute to sales metrics.
  const orders = await prisma.salesOrder.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
      status: {
        notIn: ["CANCELLED", "REFUNDED"],
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const totalCost = orders.reduce((sum, order) => sum + order.totalCost, 0);
  const profit = orders.reduce((sum, order) => sum + order.profit, 0);
  const orderCount = orders.length;

  const itemsSold = orders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    );
  }, 0);

  const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

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

  daily.revenue += order.total;
  daily.profit += order.profit;
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
    }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const existing = productMap.get(item.productId);

      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += item.lineTotal;
        existing.profit += item.lineProfit;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          quantitySold: item.quantity,
          revenue: item.lineTotal,
          profit: item.lineProfit,
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
    topProducts,
    dailySales,
    expensesByCategory,
    lowStockProducts,
    stockSummary,
    recentStockMovements
  };
};
