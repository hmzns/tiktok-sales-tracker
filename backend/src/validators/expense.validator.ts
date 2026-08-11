import { z } from "zod";

export const createExpenseSchema = z.object({
  title: z.string().min(1, "Expense title is required"),

  amount: z.coerce
    .number()
    .positive("Expense amount must be more than 0"),

  category: z
    .enum([
      "PACKAGING",
      "ADS",
      "SHIPPING",
      "SUPPLIES",
      "EQUIPMENT",
      "SALARY",
      "OTHER",
    ])
    .optional()
    .default("OTHER"),

  description: z.string().optional(),

  expenseDate: z.coerce.date().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();