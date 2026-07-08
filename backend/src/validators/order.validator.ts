import { z } from "zod";

export const createOrderSchema = z.object({
  orderNumber: z.string().optional(),
  tiktokOrderId: z.string().optional(),

  platform: z
    .enum(["MANUAL", "TIKTOK_SHOP", "SHOPEE", "LAZADA"])
    .optional()
    .default("MANUAL"),

  status: z
    .enum([
      "PENDING",
      "PAID",
      "PACKING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
    ])
    .optional()
    .default("PENDING"),

  customerName: z.string().optional(),

  discount: z.coerce.number().nonnegative("Discount cannot be negative").optional().default(0),

  shippingFee: z.coerce.number().nonnegative("Shipping fee cannot be negative").optional().default(0),

  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.coerce
          .number()
          .int("Quantity must be a whole number")
          .positive("Quantity must be more than 0"),

        // Optional override. If not provided, system uses product.sellPrice.
        sellPrice: z.coerce
          .number()
          .nonnegative("Sell price cannot be negative")
          .optional(),
      })
    )
    .min(1, "Order must have at least one item"),
});