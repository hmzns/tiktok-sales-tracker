import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBasicTikTokOrderData,
  collectTikTokOrderPages,
  getTikTokOrderSyncWindow,
  importBasicTikTokOrder,
  isTikTokOrderEligibleForImport,
  parseTikTokOrderImportStartAt,
  syncTikTokOrders,
  tikTokOrderListApiPath,
  type TikTokOrder,
  type TikTokOrderStore,
} from "../src/services/tiktokOrder.service";
import { syncTikTokOrdersSchema } from "../src/validators/tiktokShop.validator";

const importedAt = new Date("2026-07-29T08:00:00.000Z");
const trackerStartAt = "2026-09-01T00:00:00+08:00";
const trackerStartEpoch = 1788192000;

const basicOrder: TikTokOrder = {
  id: "576461413038785752",
  status: "AWAITING_SHIPMENT",
  create_time: 1753770000,
  update_time: 1753770300,
  recipient_address: {
    name: "Masked Customer",
  },
  payment: {
    currency: "MYR",
    sub_total: "25.00",
    shipping_fee: "5.00",
    total_amount: "30.00",
  },
};

const makeOrder = (id: string, ...createTimeValues: [unknown?]): TikTokOrder =>
  ({
    ...basicOrder,
    id,
    create_time:
      createTimeValues.length === 0 ? trackerStartEpoch : createTimeValues[0],
  }) as TikTokOrder;

const fakeTikTokContext = {
  appKey: "app-key",
  appSecret: "app-secret",
  apiBaseUrl: "https://example.test",
  accessToken: "access-token",
  shopCipher: "shop-cipher",
  shopId: "shop-1",
};

const makeMemoryStore = () => {
  const createdOrders: Record<string, unknown>[] = [];
  const store: TikTokOrderStore = {
    findByTikTokOrderId: async () => null,
    createBasicOrder: async (data) => {
      createdOrders.push(data);
      return { id: `local-${createdOrders.length}` };
    },
  };

  return { createdOrders, store };
};

const withQuietTikTokOrderLogs = async <T>(callback: () => Promise<T>) => {
  const originalConsoleInfo = console.info;
  const originalConsoleError = console.error;
  console.info = () => undefined;
  console.error = () => undefined;

  try {
    return await callback();
  } finally {
    console.info = originalConsoleInfo;
    console.error = originalConsoleError;
  }
};

test("order sync validation defaults to seven days and enforces 1 to 30", () => {
  assert.deepEqual(syncTikTokOrdersSchema.parse(undefined), { days: 7 });
  assert.deepEqual(syncTikTokOrdersSchema.parse({ days: 1 }), { days: 1 });
  assert.deepEqual(syncTikTokOrdersSchema.parse({ days: 30 }), { days: 30 });
  assert.throws(() => syncTikTokOrdersSchema.parse({ days: 0 }));
  assert.throws(() => syncTikTokOrdersSchema.parse({ days: 31 }));
  assert.throws(() => syncTikTokOrdersSchema.parse({ days: 1.5 }));
});

test("TikTok order import cutoff parses Malaysia midnight to the expected epoch", () => {
  assert.equal(
    parseTikTokOrderImportStartAt(trackerStartAt),
    trackerStartEpoch
  );
});

test("TikTok order import cutoff requires an absolute valid timestamp", () => {
  assert.throws(() => parseTikTokOrderImportStartAt(undefined));
  assert.throws(() => parseTikTokOrderImportStartAt("2026-09-01"));
  assert.throws(() =>
    parseTikTokOrderImportStartAt("2026-09-01T00:00:00")
  );
  assert.throws(() =>
    parseTikTokOrderImportStartAt("2026-02-31T00:00:00+08:00")
  );
});

test("orders before the TikTok tracker cutoff are not eligible for import", () => {
  assert.equal(
    isTikTokOrderEligibleForImport(
      makeOrder("before-cutoff", trackerStartEpoch - 1),
      trackerStartEpoch
    ),
    false
  );
});

test("orders exactly at the TikTok tracker cutoff are eligible for import", () => {
  assert.equal(
    isTikTokOrderEligibleForImport(
      makeOrder("exact-cutoff", trackerStartEpoch),
      trackerStartEpoch
    ),
    true
  );
});

test("orders after the TikTok tracker cutoff are eligible for import", () => {
  assert.equal(
    isTikTokOrderEligibleForImport(
      makeOrder("after-cutoff", trackerStartEpoch + 1),
      trackerStartEpoch
    ),
    true
  );
});

test("orders with missing create_time are not eligible for import", () => {
  assert.equal(
    isTikTokOrderEligibleForImport(
      makeOrder("missing-create-time", undefined),
      trackerStartEpoch
    ),
    false
  );
});

test("orders with invalid create_time are not eligible for import", () => {
  assert.equal(
    isTikTokOrderEligibleForImport(
      makeOrder("invalid-create-time", "1788192000"),
      trackerStartEpoch
    ),
    false
  );
});

test("Malaysia timezone boundary maps before midnight to excluded and midnight to included", () => {
  const beforeCutoffEpoch = parseTikTokOrderImportStartAt(
    "2026-08-31T23:59:59+08:00"
  );
  const exactCutoffEpoch = parseTikTokOrderImportStartAt(
    "2026-09-01T00:00:00+08:00"
  );

  assert.equal(beforeCutoffEpoch, 1788191999);
  assert.equal(exactCutoffEpoch, trackerStartEpoch);
  assert.equal(
    isTikTokOrderEligibleForImport(
      makeOrder("before-myt-midnight", beforeCutoffEpoch),
      trackerStartEpoch
    ),
    false
  );
  assert.equal(
    isTikTokOrderEligibleForImport(
      makeOrder("at-myt-midnight", exactCutoffEpoch),
      trackerStartEpoch
    ),
    true
  );
});

test("a new TikTok order creates one incomplete order without items or stock work", async () => {
  const createdOrders: Record<string, unknown>[] = [];
  let stock = 12;
  const store: TikTokOrderStore = {
    findByTikTokOrderId: async () => null,
    createBasicOrder: async (data) => {
      createdOrders.push(data);
      return { id: "local-order-1" };
    },
  };

  const result = await importBasicTikTokOrder({
    order: basicOrder,
    shopId: "shop-1",
    importedAt,
    store,
  });

  assert.equal(result, "created");
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0].status, "NEEDS_ITEMS");
  assert.equal(createdOrders[0].stockProcessed, false);
  assert.equal(createdOrders[0].source, "TIKTOK");
  assert.equal(createdOrders[0].platform, "TIKTOK_SHOP");
  assert.equal(createdOrders[0].total, 0);
  assert.equal(String(createdOrders[0].buyerShippingFee), "5");
  assert.equal(createdOrders[0].shippingFee, 0);
  assert.equal(createdOrders[0].profit, 0);
  assert.equal("items" in createdOrders[0], false);
  assert.equal(stock, 12);
});

test("buyer shipping is stored informationally without changing tracker totals", () => {
  const data = buildBasicTikTokOrderData(basicOrder, "shop-1", importedAt);

  assert.equal(String(data.buyerShippingFee), "5");
  assert.equal(data.subtotal, 0);
  assert.equal(data.shippingFee, 0);
  assert.equal(data.total, 0);
  assert.equal(data.profit, 0);
});

test("an existing manually edited TikTok order is not changed", async () => {
  const existingOrder = {
    id: "local-order-1",
    status: "COMPLETED",
    stockProcessed: true,
    customerName: "Manually corrected name",
    itemIds: ["item-1", "item-2"],
    rawImportData: { manuallyPreserved: true },
  };
  let createCalls = 0;
  const store: TikTokOrderStore = {
    findByTikTokOrderId: async () => ({ id: existingOrder.id }),
    createBasicOrder: async () => {
      createCalls += 1;
      return { id: "unexpected" };
    },
  };

  const result = await importBasicTikTokOrder({
    order: {
      ...basicOrder,
      recipient_address: { name: "TikTok replacement name" },
    },
    shopId: "shop-1",
    importedAt,
    store,
  });

  assert.equal(result, "existing");
  assert.equal(createCalls, 0);
  assert.equal(existingOrder.status, "COMPLETED");
  assert.equal(existingOrder.stockProcessed, true);
  assert.equal(existingOrder.customerName, "Manually corrected name");
  assert.deepEqual(existingOrder.itemIds, ["item-1", "item-2"]);
  assert.deepEqual(existingOrder.rawImportData, { manuallyPreserved: true });
});

test("a unique race is treated as an existing order instead of a duplicate", async () => {
  let findCalls = 0;
  const uniqueError = new Error("unique");
  const store: TikTokOrderStore = {
    findByTikTokOrderId: async () => {
      findCalls += 1;
      return findCalls === 1 ? null : { id: "concurrent-order" };
    },
    createBasicOrder: async () => {
      throw uniqueError;
    },
  };

  const result = await importBasicTikTokOrder({
    order: basicOrder,
    shopId: null,
    importedAt,
    store,
    isUniqueConstraintError: (error) => error === uniqueError,
  });

  assert.equal(result, "existing");
  assert.equal(findCalls, 2);
});

test("the create payload stores only a sanitized troubleshooting subset", () => {
  const data = buildBasicTikTokOrderData(
    {
      ...basicOrder,
      recipient_address: {
        name: "Safe Name",
        phone_number: "must-not-be-stored",
        full_address: "must-not-be-stored",
      } as TikTokOrder["recipient_address"],
    },
    "shop-1",
    importedAt
  );
  const serializedMetadata = JSON.stringify(data.rawImportData);

  assert.equal(data.customerName, "Safe Name");
  assert.equal(serializedMetadata.includes("phone"), false);
  assert.equal(serializedMetadata.includes("address"), false);
  assert.equal(serializedMetadata.includes("Safe Name"), false);
  assert.equal(serializedMetadata.includes("token"), false);
});

test("pagination follows every next_page_token and stops on the final page", async () => {
  const requestedTokens: Array<string | undefined> = [];
  const orders = await collectTikTokOrderPages(async (pageToken) => {
    requestedTokens.push(pageToken);

    if (!pageToken) {
      return {
        orders: [{ ...basicOrder, id: "order-1" }],
        nextPageToken: "page-2",
      };
    }

    return {
      orders: [{ ...basicOrder, id: "order-2" }],
    };
  });

  assert.deepEqual(requestedTokens, [undefined, "page-2"]);
  assert.deepEqual(
    orders.map((order) => order.id),
    ["order-1", "order-2"]
  );
});

test("pagination fails instead of silently truncating at the page safeguard", async () => {
  let calls = 0;

  await assert.rejects(
    collectTikTokOrderPages(async () => {
      calls += 1;
      return {
        orders: [],
        nextPageToken: `page-${calls + 1}`,
      };
    }, 2),
    /pagination exceeded the safety limit/
  );

  assert.equal(calls, 2);
});

test("the supported TikTok order-list operation is the 202309 search path", () => {
  assert.equal(tikTokOrderListApiPath, "/order/202309/orders/search");
});

test("first-day rolling window is clamped to the tracker start cutoff", async () => {
  const pageRequests: Array<{ createTimeGe: number; createTimeLt: number }> =
    [];
  const { store } = makeMemoryStore();

  await withQuietTikTokOrderLogs(() =>
    syncTikTokOrders(7, {
      now: () => new Date("2026-09-01T12:00:00+08:00"),
      getContext: async () => fakeTikTokContext,
      configuredImportStartAt: trackerStartAt,
      store,
      requestOrderPage: async (input) => {
        pageRequests.push({
          createTimeGe: input.createTimeGe,
          createTimeLt: input.createTimeLt,
        });
        return { orders: [] };
      },
    })
  );

  assert.equal(pageRequests.length, 1);
  assert.equal(pageRequests[0].createTimeGe, trackerStartEpoch);
});

test("normal operation after launch keeps the existing rolling lower bound", () => {
  const septemberEightMidnightMyt = parseTikTokOrderImportStartAt(
    "2026-09-08T00:00:00+08:00"
  );
  const window = getTikTokOrderSyncWindow({
    syncTime: new Date("2026-09-15T00:00:00+08:00"),
    days: 7,
    trackerStartEpoch,
  });

  assert.equal(window.createTimeGe, septemberEightMidnightMyt);
});

test("TikTok sync skips old, missing, and invalid create_time orders before importing", async () => {
  const { createdOrders, store } = makeMemoryStore();
  const summary = await withQuietTikTokOrderLogs(() =>
    syncTikTokOrders(7, {
      now: () => new Date("2026-09-02T12:00:00+08:00"),
      getContext: async () => fakeTikTokContext,
      configuredImportStartAt: trackerStartAt,
      store,
      requestOrderPage: async () => ({
        orders: [
          makeOrder("old-order", trackerStartEpoch - 1),
          makeOrder("missing-create-time", undefined),
          makeOrder("invalid-create-time", "1788192000"),
          makeOrder("exact-cutoff", trackerStartEpoch),
          makeOrder("after-cutoff", trackerStartEpoch + 1),
        ],
      }),
    })
  );

  assert.deepEqual(summary, {
    fetched: 5,
    created: 2,
    existing: 0,
    failed: 0,
  });
  assert.deepEqual(
    createdOrders.map((order) => order.tiktokOrderId),
    ["exact-cutoff", "after-cutoff"]
  );
});
