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
  limit = 20,
  search = "",
  category: ExpenseCategory | "ALL" = "ALL"
): Promise<ExpensesResponse> => {
  const params: Record<string, string | number> = {
    page,
    limit,
  };

  if (search.trim()) {
    params.search = search.trim();
  }

  if (category !== "ALL") {
    params.category = category;
  }

  const response = await apiClient.get("/expenses", {
    params,
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

export type UpdateExpenseInput = {
  title?: string;
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
  expenseDate?: string;
};

export const getExpenseById = async (expenseId: string): Promise<Expense> => {
  const response = await apiClient.get(`/expenses/${expenseId}`);
  return response.data.data;
};

export const updateExpense = async (
  expenseId: string,
  data: UpdateExpenseInput
) => {
  const response = await apiClient.put(`/expenses/${expenseId}`, data);
  return response.data.data;
};

export const deleteExpense = async (expenseId: string) => {
  const response = await apiClient.delete(`/expenses/${expenseId}`);
  return response.data.data;
};