import { Request, Response } from "express";
import {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "../services/expense.service";
import { AppError } from "../utils/AppError";

export const addExpense = async (req: Request, res: Response) => {
  const expense = await createExpense(req.body);

  return res.status(201).json({
    success: true,
    data: expense,
  });
};

export const getExpenses = async (req: Request, res: Response) => {
  const expenses = await getAllExpenses();

  return res.json({
    success: true,
    data: expenses,
  });
};

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