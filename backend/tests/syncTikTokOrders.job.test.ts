import assert from "node:assert/strict";
import test from "node:test";
import {
  getTikTokAutoSyncDays,
  getTikTokAutoSyncFailureCategory,
  runTikTokAutoSync,
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
    "SHOP_METADATA_MISSING"
  );
  assert.equal(
    getTikTokAutoSyncFailureCategory(new Error("sensitive details")),
    "UNKNOWN"
  );
});

test("the standalone job runs the monitored sync with SCHEDULED source", async () => {
  const syncCalls: Array<{ days: number; source: string }> = [];
  const exitCodes: number[] = [];
  const originalConsoleInfo = console.info;
  console.info = () => undefined;

  try {
    await runTikTokAutoSync({
      configuredDays: "4",
      syncOrders: async (days, source) => {
        syncCalls.push({ days, source });
        return { fetched: 2, created: 1, existing: 1, failed: 0 };
      },
      disconnect: async () => undefined,
      setExitCode: (code) => {
        exitCodes.push(code);
      },
    });
  } finally {
    console.info = originalConsoleInfo;
  }

  assert.deepEqual(syncCalls, [{ days: 4, source: "SCHEDULED" }]);
  assert.deepEqual(exitCodes, [0]);
});
