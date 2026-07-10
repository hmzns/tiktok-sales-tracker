import prisma from "../lib/prisma";

type MonthlyReportFilter = {
  year?: number;
  month?: number;
};

const getMonthRange = (year?: number, month?: number) => {
  const now = new Date();

  const selectedYear = year ?? now.getFullYear();
  const selectedMonth = month ?? now.getMonth() + 1;

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
    orderBy: {
      createdAt: "asc",
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              category: true,
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

  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      sku: string;
      category: string | null;
      quantitySold: number;
      revenue: number;
      cost: number;
      profit: number;
    }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const existing = productMap.get(item.productId);

      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += item.lineTotal;
        existing.cost += item.lineCost;
        existing.profit += item.lineProfit;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku,
          category: item.product.category?.name ?? null,
          quantitySold: item.quantity,
          revenue: item.lineTotal,
          cost: item.lineCost,
          profit: item.lineProfit,
        });
      }
    }
  }

  const productSummary = Array.from(productMap.values()).sort(
    (a, b) => b.quantitySold - a.quantitySold
  );

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
    expenseRows,
    expensesByCategory,
  };
};