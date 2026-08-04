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

export type ProductPerformanceRow = {
  productId: string;
  name: string;
  sku: string;
  isActive: boolean;
  unitsSold: number;
  orderCount: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  averageSellingPrice: number;
  grossProfit: number;
  profitMargin: number | null;
};

export type ProductPerformance = {
  profitAccuracy: "HISTORICAL_ORDER_ITEM_COST";
  summary: {
    productCount: number;
    unitsSold: number;
    grossRevenue: number;
    discountAmount: number;
    netRevenue: number;
    grossProfit: number;
  };
  highlights: {
    bestSellingProduct: {
      productId: string;
      name: string;
      sku: string;
      unitsSold: number;
    } | null;
    highestRevenueProduct: {
      productId: string;
      name: string;
      sku: string;
      netRevenue: number;
    } | null;
  };
  products: ProductPerformanceRow[];
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
  productPerformance: ProductPerformance;
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
