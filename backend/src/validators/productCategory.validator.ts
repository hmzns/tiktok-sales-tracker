import { z } from "zod";

export const createProductCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductCategorySchema =
  createProductCategorySchema.partial();