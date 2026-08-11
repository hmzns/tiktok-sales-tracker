import assert from "node:assert/strict";
import test from "node:test";
import {
  getTikTokSyncHistory,
  syncTikTokOrdersWithHistory,
  TikTokSyncSource,
  TikTokSyncStatus,
  type SafeTikTokSyncRun,
  type TikTokSyncHistoryReader,
  type TikTokSyncRunWrite,
} from "../src/services/tiktokSync.service";
import { AppError } from "../src/utils/AppError";
import { tikTokSyncHistoryQuerySchema } from "../src/validators/tiktokShop.validator";

const summary = {
  fetched: 5,
  created: 2,
  existing: 2,
  failed: 1,
};

test("a successful manual sync creates one safe SUCCESS history record", async () => {
  const writes: TikTokSyncRunWrite[] = [];
  const times = [
    new Date("2026-08-03T01:00:00.000Z"),
    new Date("2026-08-03T01:00:00.125Z"),
  ];

  const result = await syncTikTokOrdersWithHistory(
    7,
    TikTokSyncSource.MANUAL,
    {
      syncOrders: async () => summary,
      historyWriter: {
        create: async (data) => {
          writes.push(data);
        },
      },
      now: () => times.shift() as Date,
    }
  );

  assert.equal(result, summary);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    source: "MANUAL",
    status: "SUCCESS",
    days: 7,
    fetched: 5,
    created: 2,
    existing: 2,
    failed: 1,
    errorCategory: null,
    startedAt: new Date("2026-08-03T01:00:00.000Z"),
    completedAt: new Date("2026-08-03T01:00:00.125Z"),
    durationMs: 125,
  });
});

test("a failed sync records a safe FAILED category and rethrows the original error", async () => {
  const writes: TikTokSyncRunWrite[] = [];
  const originalError = new AppError(
    "TikTok Shop metadata must be synchronized before orders; secret raw detail",
    409
  );

  await assert.rejects(
    syncTikTokOrdersWithHistory(3, TikTokSyncSource.MANUAL, {
      syncOrders: async () => {
        throw originalError;
      },
      historyWriter: {
        create: async (data) => {
          writes.push(data);
        },
      },
    }),
    (error: unknown) => error === originalError
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, "FAILED");
  assert.equal(writes[0].errorCategory, "SHOP_METADATA_MISSING");
  assert.equal(writes[0].fetched, 0);
  assert.equal(writes[0].created, 0);
  assert.equal(writes[0].existing, 0);
  assert.equal(writes[0].failed, 0);
  assert.equal(JSON.stringify(writes[0]).includes("secret raw detail"), false);
});

test("a history-write failure logs only its event and preserves a successful result", async () => {
  const loggedArguments: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...arguments_) => {
    loggedArguments.push(arguments_);
  };

  try {
    const result = await syncTikTokOrdersWithHistory(
      2,
      TikTokSyncSource.MANUAL,
      {
        syncOrders: async () => summary,
        historyWriter: {
          create: async () => {
            throw new Error("database password and raw failure details");
          },
        },
      }
    );

    assert.equal(result, summary);
    assert.deepEqual(loggedArguments, [
      ["tiktok_sync_history_write_failed"],
    ]);
  } finally {
    console.error = originalConsoleError;
  }
});

const makeRun = (
  id: string,
  status: "SUCCESS" | "FAILED",
  completedAt: string,
  errorCategory: string | null = null
): SafeTikTokSyncRun => ({
  id,
  source: TikTokSyncSource.MANUAL,
  status:
    status === "SUCCESS"
      ? TikTokSyncStatus.SUCCESS
      : TikTokSyncStatus.FAILED,
  days: 7,
  fetched: status === "SUCCESS" ? 1 : 0,
  created: status === "SUCCESS" ? 1 : 0,
  existing: 0,
  failed: 0,
  errorCategory,
  startedAt: new Date(new Date(completedAt).getTime() - 100),
  completedAt: new Date(completedAt),
  durationMs: 100,
});

test("history is newest first and lastSuccessful ignores newer failed runs", async () => {
  const oldestSuccess = makeRun(
    "success-old",
    "SUCCESS",
    "2026-08-03T01:00:00.000Z"
  );
  const newestFailure = makeRun(
    "failure-new",
    "FAILED",
    "2026-08-03T03:00:00.000Z",
    "TIKTOK_UNAVAILABLE"
  );
  const latestSuccess = makeRun(
    "success-latest",
    "SUCCESS",
    "2026-08-03T02:00:00.000Z"
  );
  const reader: TikTokSyncHistoryReader = {
    listNewest: async () => [oldestSuccess, newestFailure, latestSuccess],
    findLastSuccessful: async () => latestSuccess,
  };

  const result = await getTikTokSyncHistory(10, reader);

  assert.deepEqual(
    result.history.map((run) => run.id),
    ["failure-new", "success-latest", "success-old"]
  );
  assert.equal(result.lastAttempt?.id, "failure-new");
  assert.equal(result.lastSuccessful?.id, "success-latest");
  assert.equal(
    JSON.stringify(result).includes("database password"),
    false
  );
});

test("history limit defaults to 10 and permits at most 50", () => {
  assert.deepEqual(tikTokSyncHistoryQuerySchema.parse({}), { limit: 10 });
  assert.deepEqual(tikTokSyncHistoryQuerySchema.parse({ limit: "1" }), {
    limit: 1,
  });
  assert.deepEqual(tikTokSyncHistoryQuerySchema.parse({ limit: "50" }), {
    limit: 50,
  });
  assert.equal(
    tikTokSyncHistoryQuerySchema.safeParse({ limit: "51" }).success,
    false
  );
  assert.equal(
    tikTokSyncHistoryQuerySchema.safeParse({ limit: "invalid" }).success,
    false
  );
});
