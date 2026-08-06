import { z } from "zod";

const discountValueSchema = z.coerce
  .number()
  .finite("Discount value must be a finite number");

const structuredDiscountSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("NONE"),
    value: discountValueSchema
      .refine((value) => value === 0, "No Discount value must be zero")
      .optional()
      .default(0),
  }),
  z.object({
    type: z.literal("FIXED"),
    value: discountValueSchema.nonnegative("Discount cannot be negative"),
  }),
  z.object({
    type: z.literal("PERCENTAGE"),
    value: discountValueSchema
      .min(0, "Discount percentage cannot be negative")
      .max(100, "Discount percentage cannot exceed 100"),
  }),
]);

// Preserve compatibility with the original numeric fixed-discount request.
const orderDiscountSchema = z.preprocess((value) => {
  if (typeof value === "number" || typeof value === "string") {
    const numericValue = Number(value);
    return {
      type: numericValue === 0 ? "NONE" : "FIXED",
      value: numericValue,
    };
  }

  return value;
}, structuredDiscountSchema);

const defaultDiscount = { type: "NONE", value: 0 } as const;

export const createOrderSchema = z.object({
  orderNumber: z.string().optional(),
  tiktokOrderId: z.string().optional(),

  platform: z
    .enum(["MANUAL", "TIKTOK_SHOP", "SHOPEE", "LAZADA"])
    .optional()
    .default("MANUAL"),

  status: z
    .enum(["NEEDS_ITEMS", "COMPLETED", "CANCELLED", "REFUNDED"])
    .optional()
    .default("COMPLETED"),

  customerName: z.string().optional(),

  discount: orderDiscountSchema.optional().default(defaultDiscount),

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

export const updateOrderStatusSchema = z.object({
  status: z.enum(["NEEDS_ITEMS", "COMPLETED", "CANCELLED", "REFUNDED"]),
});

export const completeImportedOrderSchema = z
  .object({
    discount: orderDiscountSchema.optional().default(defaultDiscount),
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1, "Product ID is required"),
          quantity: z.coerce
            .number()
            .int("Quantity must be a whole number")
            .positive("Quantity must be more than 0"),
          sellPrice: z
            .union([
              z.number(),
              z.string().trim().min(1, "Sell price is required"),
            ])
            .transform(Number)
            .refine(Number.isFinite, {
              message: "Sell price must be a finite number",
            })
            .refine((value) => value >= 0, {
              message: "Sell price cannot be negative",
            })
            .optional(),
        })
      )
      .min(1, "Order must have at least one item"),
  })
  .superRefine((data, context) => {
    const seenProductIds = new Set<string>();

    data.items.forEach((item, index) => {
      if (seenProductIds.has(item.productId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "productId"],
          message: "Duplicate product IDs are not allowed",
        });
      }

      seenProductIds.add(item.productId);
    });
  });
