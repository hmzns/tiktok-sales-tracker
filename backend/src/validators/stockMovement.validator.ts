import { z } from "zod";

export const adjustStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),

  type: z.enum(["RESTOCK", "MANUAL_IN", "MANUAL_OUT", "DAMAGE"]),

  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be more than 0"),

  note: z.string().optional(),
  reference: z.string().optional(),
});