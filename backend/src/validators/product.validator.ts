import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  costPrice: z.number()
    .nonnegative("Cost price cannot be negative"),
  sellPrice: z.number()
    .nonnegative("Sell price cannot be negative"),
  stock: z.number()
    .int("Stock must be a whole number")
    .nonnegative("Stock cannot be negative")
    .optional()
    .default(0),
});

export const updateProductSchema = createProductSchema.partial();