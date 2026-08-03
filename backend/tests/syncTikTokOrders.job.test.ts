import assert from "node:assert/strict";
import test from "node:test";
import {
  getTikTokAutoSyncDays,
  getTikTokAutoSyncFailureCategory,
} from "../src/jobs/syncTikTokOrders";
import { AppError } from "../src/utils/AppError";

test("automatic sync days default to two and accept only integers from 1 to 30", () => {
  assert.equal(getTikTokAutoSyncDays(undefined), 2);
  assert.equal(getTikTokAutoSyncDays(""), 2);
  assert.equal(getTikTokAutoSyncDays("invalid"), 2);
  assert.equal(getTikTokAutoSyncDays("2.5"), 2);
  assert.equal(getTikTokAutoSyncDays("0"), 2);
  assert.equal(getTikTokAutoSyncDays("31"), 2);
  assert.equal(getTikTokAutoSyncDays(" 1 "), 1);
  assert.equal(getTikTokAutoSyncDays("30"), 30);
});

test("automatic sync failure categories do not expose error details", () => {
  assert.equal(
    getTikTokAutoSyncFailureCategory(
      new AppError("TikTok Shop metadata must be synchronized before orders", 409)
    ),
    "tiktok_shop_metadata_missing"
  );
  assert.equal(
    getTikTokAutoSyncFailureCategory(new Error("sensitive details")),
    "unexpected_service_error"
  );
});
