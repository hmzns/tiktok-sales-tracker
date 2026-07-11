import { apiClient } from "./client";

export type ExpenseCategory =
  | "PACKAGING"
  | "ADS"
  | "SHIPPING"
  | "SUPPLIES"
  | "EQUIPMENT"
  | "SALARY"
  | "OTHER";

export type Expense = {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpensesResponse = {
  expenses: Expense[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
  category: ExpenseCategory;
  description?: string;
  expenseDate?: string;
};

export const getExpenses = async (
  page = 1,
  limit = 20
): Promise<ExpensesResponse> => {
  const response = await apiClient.get("/expenses", {
    params: {
      page,
      limit,
    },
  });

  return {
    expenses: response.data.data,
    meta: response.data.meta,
  };
};

export const createExpense = async (data: CreateExpenseInput) => {
  const response = await apiClient.post("/expenses", data);
  return response.data.data;
};