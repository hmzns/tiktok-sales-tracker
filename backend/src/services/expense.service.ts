import prisma from "../lib/prisma";
import type { Prisma } from "@prisma/client";

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

// POST /expenses
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

// GET /expenses
type ExpenseFilter = {
  search?: string;
  category?:
    | "PACKAGING"
    | "ADS"
    | "SHIPPING"
    | "SUPPLIES"
    | "EQUIPMENT"
    | "SALARY"
    | "OTHER";
  page?: number;
  limit?: number;
};

export const getAllExpenses = async (filter: ExpenseFilter = {}) => {
  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;
  const skip = (page - 1) * limit;

  const where: Prisma.ExpenseWhereInput = {};

  if (filter.search) {
    where.OR = [
      {
        title: {
          contains: filter.search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: filter.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (filter.category) {
    where.category = filter.category;
  }

  const [expenses, total] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      orderBy: {
        expenseDate: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.expense.count({
      where,
    }),
  ]);

  return {
    expenses,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

// GET /expenses/:id
export const getExpenseById = async (id: string) => {
  return prisma.expense.findUnique({
    where: {
      id,
    },
  });
};

// PATCH /expenses/:id
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

// DELETE /expenses/:id
export const deleteExpense = async (id: string) => {
  return prisma.expense.delete({
    where: {
      id,
    },
  });
};