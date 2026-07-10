import { z } from "zod";

export const createProductSchema = z.object({
  name: z
    .string({ error: "Product name is required" })
    .min(1, "Product name is required"),

  sku: z
    .string({ error: "SKU is required" })
    .min(1, "SKU is required"),

  costPrice: z
    .number({ error: "Cost price is required" })
    .nonnegative("Cost price cannot be negative"),

  sellPrice: z
    .number({ error: "Sell price is required" })
    .nonnegative("Sell price cannot be negative"),

  stock: z
    .number({ error: "Stock must be a number" })
    .int("Stock must be a whole number")
    .nonnegative("Stock cannot be negative")
    .optional()
    .default(0),

  categoryId: z
    .string()
    .min(1, "Category ID is required")
    .optional()
    .nullable(),
});

export const updateProductSchema = createProductSchema.partial();