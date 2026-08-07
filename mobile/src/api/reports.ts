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
  pendingFinanceOrderCount: number;
  financiallyRecognizedOrderCount: number;
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
  financeExcludedOrderCount: number;
  financeExcludedUnits: number;
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
  financeExcludedOrderCount: number;
  financeExcludedUnits: number;
};

export type ProductPerformance = {
  profitAccuracy: "HISTORICAL_ORDER_ITEM_COST";
  financeAllocation: "FULL_TIKTOK_ORDER_FINANCE_EXCLUDED_FROM_PRODUCT_METRICS";
  summary: {
    productCount: number;
    unitsSold: number;
    grossRevenue: number;
    discountAmount: number;
    netRevenue: number;
    grossProfit: number;
    financeExcludedOrderCount: number;
    financeExcludedUnits: number;
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
  total: number | null;
  profit: number | null;
  financePending: boolean;
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

export type SalesTrendDay = {
  date: string;
  orderCount: number;
  unitsSold: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  productCost: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  pendingFinanceOrderCount: number;
};

export type SalesTrendsReport = {
  reportType: "SALES_TRENDS_REPORT";
  timezone: "Asia/Kuching";
  profitAccuracy: "HISTORICAL_ORDER_ITEM_COST";
  financeAccounting: "TIKTOK_SETTLEMENT_RECOGNIZED_AT_ORDER_LEVEL";
  period: {
    startDate: string;
    endDate: string;
  };
  summary: Omit<SalesTrendDay, "date">;
  trends: SalesTrendDay[];
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

export const getSalesTrendsReport = async (
  startDate: string,
  endDate: string
): Promise<SalesTrendsReport> => {
  const response = await apiClient.get("/reports/sales-trends", {
    params: {
      startDate,
      endDate,
    },
  });

  return response.data.data;
};
