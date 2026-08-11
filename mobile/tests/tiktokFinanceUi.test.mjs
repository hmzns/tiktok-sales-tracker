import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const screenSource = await readFile(
  new URL("../src/app/order-detail.tsx", import.meta.url),
  "utf8"
);

test("Needs Items completion renders and submits a required payment-mode selector", () => {
  assert.match(screenSource, /canCompleteImportedOrder \? \(/);
  assert.match(screenSource, />Payment Method</);
  assert.match(screenSource, /TIKTOK_PAYMENT_MODE_OPTIONS\.map/);
  assert.match(screenSource, /!paymentMode \|\|/);
  assert.match(screenSource, /paymentMode,\s+discount:/);
  assert.match(screenSource, /Choose how the product was paid/);
});

test("historical TikTok orders expose confirmed payment-mode correction", () => {
  assert.match(screenSource, /"Assign payment method"/);
  assert.match(screenSource, /"Correct payment method"/);
  assert.match(screenSource, /window\.confirm\(message\)/);
  assert.match(screenSource, /Alert\.alert\("Change Payment Method"/);
  assert.match(screenSource, /saveTikTokPaymentMode/);
});

test("Finance UI labels buyer shipping informationally and preserves interpretation boundaries", () => {
  assert.match(screenSource, />Buyer Shipping Fee</);
  assert.match(screenSource, /not treated as seller\s+revenue or profit/);
  assert.match(screenSource, /"TikTok Shipping"/);
  assert.match(screenSource, />Tracker Product Revenue</);
  assert.match(screenSource, />TikTok Settlement</);
  assert.match(screenSource, />Historical Product Cost</);
  assert.match(screenSource, /"Pending TikTok settlement"/);
  assert.match(
    screenSource,
    /order\.tiktokPaymentMode === "FULL_TIKTOK" &&\s+order\.tiktokRevenueAmount/
  );
  assert.match(
    screenSource,
    /Final Profit = TikTok Settlement - Historical Product Cost/
  );
  assert.match(
    screenSource,
    /Final Profit = Tracker Product Revenue \+ TikTok Settlement -\s+Historical Product Cost/
  );
  assert.match(screenSource, /are not deducted\s+again/);
  assert.match(screenSource, /are not added or\s+subtracted again/);
});

test("FULL_TIKTOK completion shows reference snapshots without tracker discount controls", () => {
  assert.match(
    screenSource,
    /paymentMode !== "FULL_TIKTOK" \? \(\s+<View style=\{styles\.discountSection\}>/
  );
  assert.match(
    screenSource,
    /paymentMode === "FULL_TIKTOK" \? \(\s+<>[\s\S]+Tracker line value \(reference\)/
  );
  assert.match(screenSource, />\s*Historical product cost\s*</);
  assert.match(screenSource, />Tracker Price</);
  assert.match(screenSource, />Tracker Line Value</);
  assert.match(
    screenSource,
    /TikTok\s+settlement, not these values, determines final revenue and profit/
  );
  assert.match(
    screenSource,
    /Complete this inventory match and deduct the selected quantities from stock\? Profit will remain pending until TikTok settlement is available/
  );
});

test("legacy zero-price orders require explicit per-item price confirmation", () => {
  assert.match(
    screenSource,
    /Tracker price information is missing for this order/
  );
  assert.match(screenSource, /Current tracker prices are suggestions only/);
  assert.match(screenSource, /Suggested current tracker price/);
  assert.match(screenSource, /Confirmed unit price \(RM\)/);
  assert.match(screenSource, /trackerPriceCorrections/);
  assert.match(screenSource, />\s*Confirm Prices & Change\s*</);
});

test("Finance status and sync states use safe user-facing messages", () => {
  assert.match(screenSource, />Finance Status</);
  assert.match(screenSource, />Sync TikTok Finance</);
  assert.match(screenSource, />Syncing\.\.\.</);
  assert.match(screenSource, /TikTok settlement is not available yet/);
  assert.match(screenSource, /TikTok finance data updated/);
  assert.match(
    screenSource,
    /Unable to retrieve TikTok finance data\. Please try again later/
  );
});

test("Order Detail retains responsive mobile and desktop layout branches", () => {
  assert.match(screenSource, /const isSmallScreen = width < 600/);
  assert.match(screenSource, /Platform\.OS === "web" && !isSmallScreen/);
  assert.match(screenSource, /isSmallScreen && styles\.smallInfoRow/);
  assert.match(screenSource, /flexWrap: "wrap"/);
});
