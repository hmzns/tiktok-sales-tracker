import assert from "node:assert/strict";
import test from "node:test";

import {
  getNonNegativeNumberError,
  getPositiveAmountError,
  getWholeNumberNonNegativeError,
} from "../src/utils/formValidation.ts";

test("product prices and stock return field errors for invalid values", () => {
  assert.equal(
    getNonNegativeNumberError("abc", "Cost price must be 0 or more."),
    "Cost price must be 0 or more."
  );
  assert.equal(
    getNonNegativeNumberError("-1", "Sell price must be 0 or more."),
    "Sell price must be 0 or more."
  );
  assert.equal(getWholeNumberNonNegativeError("1.5"), "Stock must be a whole number.");
  assert.equal(getWholeNumberNonNegativeError("5"), "");
});

test("expense amount rejects every invalid input consistently", () => {
  for (const value of ["", "   ", "abc", "1.2.3", "0", "-1"]) {
    assert.equal(getPositiveAmountError(value), "Amount must be more than 0.");
  }

  assert.equal(getPositiveAmountError("12.50"), "");
});
