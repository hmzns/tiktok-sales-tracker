import { Request, Response } from "express";
import {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "../services/expense.service";
import { AppError } from "../utils/AppError";

// POST /expenses
export const addExpense = async (req: Request, res: Response) => {
  const expense = await createExpense(req.body);

  return res.status(201).json({
    success: true,
    data: expense,
  });
};

// GET /expenses
export const getExpenses = async (req: Request, res: Response) => {
  const search = req.query.search ? String(req.query.search) : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  const allowedCategories = [
    "PACKAGING",
    "ADS",
    "SHIPPING",
    "SUPPLIES",
    "EQUIPMENT",
    "SALARY",
    "OTHER",
  ] as const;

  const category = req.query.category
    ? String(req.query.category).toUpperCase()
    : undefined;

  if (category && !allowedCategories.includes(category as any)) {
    throw new AppError("Invalid expense category", 400);
  }

  const result = await getAllExpenses({
    search,
    page,
    limit,
    category: category as any,
  });

  return res.json({
    success: true,
    data: result.expenses,
    meta: result.meta,
  });
};

// GET /expenses/:id
export const getExpense = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const expense = await getExpenseById(id);

  if (!expense) {
    throw new AppError("Expense not found", 404);
  }

  return res.json({
    success: true,
    data: expense,
  });
};

// PATCH /expenses/:id
export const editExpense = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingExpense = await getExpenseById(id);

  if (!existingExpense) {
    throw new AppError("Expense not found", 404);
  }

  const expense = await updateExpense(id, req.body);

  return res.json({
    success: true,
    data: expense,
  });
};

// DELETE /expenses/:id
export const removeExpense = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingExpense = await getExpenseById(id);

  if (!existingExpense) {
    throw new AppError("Expense not found", 404);
  }

  await deleteExpense(id);

  return res.json({
    success: true,
    message: "Expense deleted successfully",
  });
};