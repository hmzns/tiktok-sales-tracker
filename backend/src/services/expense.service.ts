import prisma from "../lib/prisma";

type CreateExpenseInput = {
  title: string;
  amount: number;
  category?:
    | "PACKAGING"
    | "ADS"
    | "SHIPPING"
    | "SUPPLIES"
    | "EQUIPMENT"
    | "SALARY"
    | "OTHER";
  description?: string;
  expenseDate?: Date;
};

type UpdateExpenseInput = Partial<CreateExpenseInput>;

export const createExpense = async (data: CreateExpenseInput) => {
  return prisma.expense.create({
    data: {
      title: data.title,
      amount: data.amount,
      category: data.category ?? "OTHER",
      description: data.description,
      expenseDate: data.expenseDate ?? new Date(),
    },
  });
};

export const getAllExpenses = async () => {
  return prisma.expense.findMany({
    orderBy: {
      expenseDate: "desc",
    },
  });
};

export const getExpenseById = async (id: string) => {
  return prisma.expense.findUnique({
    where: {
      id,
    },
  });
};

export const updateExpense = async (
  id: string,
  data: UpdateExpenseInput
) => {
  return prisma.expense.update({
    where: {
      id,
    },
    data,
  });
};

export const deleteExpense = async (id: string) => {
  return prisma.expense.delete({
    where: {
      id,
    },
  });
};