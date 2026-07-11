import { apiClient } from "./client";

export type MonthlyReportSummary = {
  totalRevenue: number;
  totalCost: number;
  salesProfit: number;
  totalExpenses: number;
  netProfit: number;
  totalOrders: number;
  totalItemsSold: number;
  averageOrderValue: number;
};

export type ProductSummary = {
  productId: string;
  productName: string;
  sku: string;
  category: string | null;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
};

export type ExpenseByCategory = {
  category: string;
  amount: number;
};

export type ReportOrderRow = {
  orderId: string;
  orderNumber: string | null;
  platform: string;
  status: string;
  customerName: string | null;
  date: string;
  total: number;
  profit: number;
};

export type MonthlyReport = {
  reportType: string;
  period: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
  };
  summary: MonthlyReportSummary;
  orderRows: ReportOrderRow[];
  productSummary: ProductSummary[];
  expenseRows: unknown[];
  expensesByCategory: ExpenseByCategory[];
};

export const getMonthlyReport = async (
  year: number,
  month: number
): Promise<MonthlyReport> => {
  const response = await apiClient.get("/reports/monthly", {
    params: {
      year,
      month,
    },
  });

  return response.data.data;
};