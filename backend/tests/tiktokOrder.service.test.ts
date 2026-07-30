import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBasicTikTokOrderData,
  collectTikTokOrderPages,
  importBasicTikTokOrder,
  tikTokOrderListApiPath,
  type TikTokOrder,
  type TikTokOrderStore,
} from "../src/services/tiktokOrder.service";
import { syncTikTokOrdersSchema } from "../src/validators/tiktokShop.validator";

const importedAt = new Date("2026-07-29T08:00:00.000Z");

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
    total_amount: "30.00",
  },
};

test("order sync validation defaults to seven days and enforces 1 to 30", () => {
  assert.deepEqual(syncTikTokOrdersSchema.parse(undefined), { days: 7 });
  assert.deepEqual(syncTikTokOrdersSchema.parse({ days: 1 }), { days: 1 });
  assert.deepEqual(syncTikTokOrdersSchema.parse({ days: 30 }), { days: 30 });
  assert.throws(() => syncTikTokOrdersSchema.parse({ days: 0 }));
  assert.throws(() => syncTikTokOrdersSchema.parse({ days: 31 }));
  assert.throws(() => syncTikTokOrdersSchema.parse({ days: 1.5 }));
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
    updateSafeMetadata: async () => {
      assert.fail("A new order must not update an existing record");
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
  assert.equal(createdOrders[0].importStatus, "NEEDS_ITEMS");
  assert.equal(createdOrders[0].stockProcessed, false);
  assert.equal(createdOrders[0].source, "TIKTOK");
  assert.equal(createdOrders[0].platform, "TIKTOK_SHOP");
  assert.equal(createdOrders[0].total, 0);
  assert.equal("items" in createdOrders[0], false);
  assert.equal(stock, 12);
});

test("an existing manually edited TikTok order keeps items and lifecycle fields", async () => {
  const existingOrder = {
    id: "local-order-1",
    importStatus: "READY",
    stockProcessed: true,
    customerName: "Manually corrected name",
    itemIds: ["item-1", "item-2"],
    rawImportData: {},
  };
  let createCalls = 0;
  const store: TikTokOrderStore = {
    findByTikTokOrderId: async () => ({ id: existingOrder.id }),
    createBasicOrder: async () => {
      createCalls += 1;
      return { id: "unexpected" };
    },
    updateSafeMetadata: async (id, rawImportData) => {
      assert.equal(id, existingOrder.id);
      existingOrder.rawImportData = rawImportData;
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
  assert.equal(existingOrder.importStatus, "READY");
  assert.equal(existingOrder.stockProcessed, true);
  assert.equal(existingOrder.customerName, "Manually corrected name");
  assert.deepEqual(existingOrder.itemIds, ["item-1", "item-2"]);
  assert.deepEqual(existingOrder.rawImportData, {
    tiktokOrderId: basicOrder.id,
    status: basicOrder.status,
    createTime: basicOrder.create_time,
    updateTime: basicOrder.update_time,
    currency: "MYR",
    paymentSummary: {
      subTotal: "25.00",
      totalAmount: "30.00",
    },
    shopId: "shop-1",
  });
});

test("a unique race is treated as an existing order instead of a duplicate", async () => {
  let findCalls = 0;
  let metadataUpdates = 0;
  const uniqueError = new Error("unique");
  const store: TikTokOrderStore = {
    findByTikTokOrderId: async () => {
      findCalls += 1;
      return findCalls === 1 ? null : { id: "concurrent-order" };
    },
    createBasicOrder: async () => {
      throw uniqueError;
    },
    updateSafeMetadata: async () => {
      metadataUpdates += 1;
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
  assert.equal(metadataUpdates, 1);
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
