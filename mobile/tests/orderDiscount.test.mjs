import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompletionConfirmationMessage,
  calculateOrderDiscountPreview,
  DISCOUNT_OPTIONS,
} from "../src/utils/orderDiscount.ts";

test("discount controls expose NONE, FIXED, and PERCENTAGE options", () => {
  assert.deepEqual(
    DISCOUNT_OPTIONS.map((option) => option.type),
    ["NONE", "FIXED", "PERCENTAGE"]
  );
  assert.deepEqual(
    DISCOUNT_OPTIONS.map((option) => option.label),
    ["No Discount", "Fixed Amount", "Percentage"]
  );
});

test("no discount keeps subtotal as final total", () => {
  const preview = calculateOrderDiscountPreview({
    subtotal: 100,
    type: "NONE",
    value: "0",
  });

  assert.equal(preview.isValid, true);
  assert.equal(preview.discountAmount, 0);
  assert.equal(preview.finalTotal, 100);
});

test("fixed and percentage discounts calculate live summary totals", () => {
  const fixed = calculateOrderDiscountPreview({
    subtotal: 100,
    type: "FIXED",
    value: "10",
  });
  const percentage = calculateOrderDiscountPreview({
    subtotal: 100,
    type: "PERCENTAGE",
    value: "10",
  });

  assert.equal(fixed.discountAmount, 10);
  assert.equal(fixed.finalTotal, 90);
  assert.equal(percentage.discountAmount, 10);
  assert.equal(percentage.finalTotal, 90);
});

test("invalid discount values disable completion previews", () => {
  for (const input of [
    { subtotal: 100, type: "FIXED", value: "-1" },
    { subtotal: 100, type: "FIXED", value: "101" },
    { subtotal: 100, type: "PERCENTAGE", value: "101" },
    { subtotal: 100, type: "PERCENTAGE", value: "" },
    { subtotal: 0, type: "NONE", value: "0" },
  ]) {
    const preview = calculateOrderDiscountPreview(input);
    assert.equal(preview.isValid, false);
    assert.notEqual(preview.error, "");
  }
});

test("completion confirmation includes the final amount", () => {
  assert.equal(
    buildCompletionConfirmationMessage(90),
    "Complete this order for RM 90.00 and deduct the selected quantities from stock?"
  );
});
