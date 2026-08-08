import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCompletedOrderMonthChange,
  getOrderComparisonPeriods,
} from "../src/utils/orderMonthComparison.ts";

test("completed-order month change handles increases, decreases, and zero", () => {
  assert.equal(calculateCompletedOrderMonthChange(15, 10), 50);
  assert.equal(calculateCompletedOrderMonthChange(5, 10), -50);
  assert.equal(calculateCompletedOrderMonthChange(0, 10), -100);
});

test("completed-order month change has safe zero-baseline results", () => {
  assert.equal(calculateCompletedOrderMonthChange(0, 0), 0);
  assert.equal(calculateCompletedOrderMonthChange(5, 0), null);
});

test("January compares against December of the previous year", () => {
  assert.deepEqual(
    getOrderComparisonPeriods(new Date("2027-01-15T00:00:00.000Z")),
    {
      current: { year: 2027, month: 1 },
      previous: { year: 2026, month: 12 },
    }
  );
});

test("business month follows Malaysia time at a UTC month boundary", () => {
  assert.deepEqual(
    getOrderComparisonPeriods(new Date("2026-07-31T16:30:00.000Z")),
    {
      current: { year: 2026, month: 8 },
      previous: { year: 2026, month: 7 },
    }
  );
});
