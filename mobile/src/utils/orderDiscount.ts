export type DiscountType = "NONE" | "FIXED" | "PERCENTAGE";

export type OrderDiscountInput = {
  type: DiscountType;
  value: number;
};

export const DISCOUNT_OPTIONS: { type: DiscountType; label: string }[] = [
  { type: "NONE", label: "No Discount" },
  { type: "FIXED", label: "Fixed Amount" },
  { type: "PERCENTAGE", label: "Percentage" },
];

const toCents = (value: number) =>
  Math.round((value + Number.EPSILON) * 100);
const fromCents = (value: number) => value / 100;

export const calculateOrderDiscountPreview = ({
  subtotal,
  shippingFee = 0,
  type,
  value,
}: {
  subtotal: number;
  shippingFee?: number;
  type: DiscountType;
  value: string;
}) => {
  const subtotalCents = Math.max(0, toCents(subtotal));
  const shippingFeeCents = Math.max(0, toCents(shippingFee));
  const parsedValue = type === "NONE" ? 0 : Number(value);
  let error = "";

  if (subtotalCents <= 0) {
    error = "Subtotal must be greater than zero.";
  } else if (type !== "NONE" && value.trim() === "") {
    error = "Enter a discount value.";
  } else if (!Number.isFinite(parsedValue)) {
    error = "Enter a valid discount value.";
  } else if (parsedValue < 0) {
    error = "Discount cannot be negative.";
  } else if (type === "PERCENTAGE" && parsedValue > 100) {
    error = "Percentage cannot exceed 100%.";
  }

  let discountCents = 0;

  if (!error && type === "FIXED") {
    discountCents = toCents(parsedValue);
    if (discountCents > subtotalCents) {
      error = "Fixed discount cannot exceed the subtotal.";
    }
  } else if (!error && type === "PERCENTAGE") {
    discountCents = Math.round((subtotalCents * parsedValue) / 100);
  }

  if (error) {
    discountCents = 0;
  }

  return {
    isValid: !error,
    error,
    enteredValue: Number.isFinite(parsedValue) ? parsedValue : 0,
    subtotal: fromCents(subtotalCents),
    discountAmount: fromCents(discountCents),
    finalTotal: fromCents(
      subtotalCents - discountCents + shippingFeeCents
    ),
  };
};

export const buildCompletionConfirmationMessage = (finalTotal: number) =>
  `Complete this order for RM ${finalTotal.toFixed(
    2
  )} and deduct the selected quantities from stock?`;
