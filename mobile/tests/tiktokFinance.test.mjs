import assert from "node:assert/strict";
import test from "node:test";
import {
  formatFinanceMoney,
  formatTikTokFinanceStatus,
  getTikTokPaymentModeLabel,
  getTrackerProductRevenue,
  TIKTOK_PAYMENT_MODE_OPTIONS,
} from "../src/utils/tiktokFinance.ts";

test("payment mode options expose both required TikTok workflows", () => {
  assert.deepEqual(
    TIKTOK_PAYMENT_MODE_OPTIONS.map((option) => option.value),
    ["FULL_TIKTOK", "EXTERNAL_PRODUCT_PAYMENT"]
  );
  assert.equal(
    getTikTokPaymentModeLabel("EXTERNAL_PRODUCT_PAYMENT"),
    "Outside TikTok / WhatsApp"
  );
});

test("positive and negative Finance values have explicit textual signs", () => {
  assert.equal(formatFinanceMoney("2.50", "MYR", true), "+RM2.50");
  assert.equal(formatFinanceMoney("-3.20", "MYR", true), "-RM3.20");
  assert.equal(formatFinanceMoney("0", "MYR", true), "RM0.00");
  assert.equal(formatFinanceMoney("48.30", "MYR"), "RM48.30");
});

test("external product revenue remains tracker subtotal less tracker discount", () => {
  assert.equal(getTrackerProductRevenue(50, 5), 45);
  assert.equal(getTrackerProductRevenue(45.01, 0.01), 45);
});

test("nullable Finance fields have safe labels", () => {
  assert.equal(formatTikTokFinanceStatus(null), "Not synced");
  assert.equal(formatTikTokFinanceStatus("PENDING"), "Pending");
  assert.equal(formatFinanceMoney(null, "MYR"), "Not available");
});
