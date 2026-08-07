import assert from "node:assert/strict";
import test from "node:test";
import { TikTokFinanceStatus } from "@prisma/client";
import {
  parseTikTokOrderFinanceResponse,
  syncTikTokFinanceForOrder,
  tikTokOrderFinanceApiPath,
  type TikTokFinanceOrderStore,
  type TikTokOrderFinanceData,
} from "../src/services/tiktokFinance.service";
import { AppError } from "../src/utils/AppError";

const settledFinance: TikTokOrderFinanceData = {
  currency: "MYR",
  revenueAmount: "45.00",
  shippingCostAmount: "+2.50",
  feeAndTaxAmount: "-3.20",
  settlementAmount: "44.30",
};

const makeState = () => ({
  order: {
    source: "TIKTOK" as const,
    tiktokOrderId: "576461413038785752",
    financeStatus: null as TikTokFinanceStatus | null,
    tiktokPaymentMode: "FULL_TIKTOK" as
      | "FULL_TIKTOK"
      | "EXTERNAL_PRODUCT_PAYMENT",
    status: "COMPLETED",
    stockProcessed: true,
    subtotal: 50,
    discount: 5,
    total: 45,
    totalCost: 20,
    profit: null as number | null,
  },
  products: [{ id: "product-1", stock: 8 }],
  items: [
    {
      id: "item-1",
      productId: "product-1",
      quantity: 2,
      sellPrice: 25,
      costPrice: 10,
      allocatedDiscount: 5,
    },
  ],
  finance: {} as Record<string, unknown>,
});

const createStore = (state: ReturnType<typeof makeState>) => {
  const writes: Array<Record<string, unknown>> = [];
  const store: TikTokFinanceOrderStore = {
    findById: async () => ({
      source: state.order.source,
      tiktokOrderId: state.order.tiktokOrderId,
      financeStatus: state.order.financeStatus,
      tiktokPaymentMode: state.order.tiktokPaymentMode,
      subtotal: state.order.subtotal,
      discount: state.order.discount,
      items: state.items.map(({ quantity, costPrice }) => ({
        quantity,
        costPrice,
      })),
    }),
    markPending: async (_id, profit) => {
      state.order.financeStatus = TikTokFinanceStatus.PENDING;
      if (profit !== undefined) {
        state.order.profit = profit;
      }
      writes.push({
        financeStatus: TikTokFinanceStatus.PENDING,
        ...(profit !== undefined ? { profit } : {}),
      });
    },
    markSettled: async (_id, data) => {
      state.order.financeStatus = TikTokFinanceStatus.SETTLED;
      state.order.profit = data.profit;
      Object.assign(state.finance, data);
      writes.push(data);
    },
  };

  return { store, writes };
};

test("uses the current v202501 order Finance endpoint", () => {
  assert.equal(
    tikTokOrderFinanceApiPath,
    "/finance/202501/orders/{order_id}/statement_transactions"
  );
  assert.equal(tikTokOrderFinanceApiPath.includes("202309"), false);
});

test("parses the v202501 top-level aggregate response without the retired transaction array", () => {
  assert.deepEqual(
    parseTikTokOrderFinanceResponse({
      code: 0,
      data: {
        order_id: "576461413038785752",
        currency: "myr",
        revenue_amount: "45.00",
        shipping_cost_amount: "-2.50",
        fee_and_tax_amount: "-3.20",
        settlement_amount: "39.30",
        sku_transactions: [{ ignored: "not persisted" }],
      },
      request_id: "not-persisted",
    }),
    {
      currency: "MYR",
      revenueAmount: "45.00",
      shippingCostAmount: "-2.50",
      feeAndTaxAmount: "-3.20",
      settlementAmount: "39.30",
    }
  );

  assert.equal(
    parseTikTokOrderFinanceResponse({ code: 0, data: null }),
    null
  );
  assert.throws(
    () =>
      parseTikTokOrderFinanceResponse({
        code: 0,
        data: { statement_transactions: [] },
      }),
    /Unable to retrieve TikTok finance data/
  );
});

test("settled Finance data persists only safe aggregate values and preserves signed shipping", async () => {
  const state = makeState();
  const beforeBusinessData = structuredClone({
    order: state.order,
    products: state.products,
    items: state.items,
  });
  const { store, writes } = createStore(state);
  const syncedAt = new Date("2026-08-07T02:00:00.000Z");

  const result = await syncTikTokFinanceForOrder("order-1", {
    fetchFinance: async () => settledFinance,
    store,
    now: () => syncedAt,
  });

  assert.deepEqual(result, { financeStatus: TikTokFinanceStatus.SETTLED });
  assert.equal(writes.length, 1);
  assert.deepEqual(state.finance, {
    financeStatus: TikTokFinanceStatus.SETTLED,
    financeCurrency: "MYR",
    tiktokRevenueAmount: "45.00",
    tiktokShippingCostAmount: "+2.50",
    tiktokFeeAndTaxAmount: "-3.20",
    tiktokSettlementAmount: "44.30",
    financeSyncedAt: syncedAt,
    profit: 24.3,
  });
  assert.equal(state.finance.tiktokShippingCostAmount, "+2.50");
  assert.deepEqual(state.products, beforeBusinessData.products);
  assert.deepEqual(state.items, beforeBusinessData.items);
  assert.equal(state.order.status, beforeBusinessData.order.status);
  assert.equal(
    state.order.stockProcessed,
    beforeBusinessData.order.stockProcessed
  );
  assert.equal(state.order.discount, beforeBusinessData.order.discount);
  assert.equal(state.order.total, beforeBusinessData.order.total);
  assert.equal(state.order.profit, 24.3);
  assert.equal(JSON.stringify(result).includes("access"), false);
  assert.equal(JSON.stringify(result).includes("raw"), false);
  assert.deepEqual(Object.keys(writes[0]).sort(), [
    "financeCurrency",
    "financeStatus",
    "financeSyncedAt",
    "profit",
    "tiktokFeeAndTaxAmount",
    "tiktokRevenueAmount",
    "tiktokSettlementAmount",
    "tiktokShippingCostAmount",
  ]);
});

test("an unsettled FULL_TIKTOK Finance response becomes PENDING with null profit", async () => {
  const state = makeState();
  const before = structuredClone(state);
  const { store, writes } = createStore(state);

  const result = await syncTikTokFinanceForOrder("order-1", {
    fetchFinance: async () => null,
    store,
  });

  assert.deepEqual(result, { financeStatus: TikTokFinanceStatus.PENDING });
  assert.deepEqual(writes, [
    { financeStatus: TikTokFinanceStatus.PENDING, profit: null },
  ]);
  assert.deepEqual(state.products, before.products);
  assert.deepEqual(state.items, before.items);
  assert.equal(state.order.status, before.order.status);
  assert.equal(state.order.discount, before.order.discount);
  assert.equal(state.order.profit, null);
  assert.deepEqual(state.finance, {});
});

test("repeat Finance sync is idempotent and does not alter stock, items, discounts, or order status", async () => {
  const state = makeState();
  const { store, writes } = createStore(state);
  const fetchFinance = async () => settledFinance;
  const now = () => new Date("2026-08-07T02:00:00.000Z");
  const preserved = structuredClone({
    products: state.products,
    items: state.items,
    status: state.order.status,
    discount: state.order.discount,
    stockProcessed: state.order.stockProcessed,
  });

  await syncTikTokFinanceForOrder("order-1", {
    fetchFinance,
    store,
    now,
  });
  await syncTikTokFinanceForOrder("order-1", {
    fetchFinance,
    store,
    now,
  });

  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0], writes[1]);
  assert.deepEqual(state.products, preserved.products);
  assert.deepEqual(state.items, preserved.items);
  assert.equal(state.order.status, preserved.status);
  assert.equal(state.order.discount, preserved.discount);
  assert.equal(state.order.stockProcessed, preserved.stockProcessed);
  assert.equal(state.order.profit, 24.3);
});

test("EXTERNAL_PRODUCT_PAYMENT profit adds tracker net product revenue to settlement exactly once", async () => {
  const state = makeState();
  state.order.tiktokPaymentMode = "EXTERNAL_PRODUCT_PAYMENT";
  state.order.profit = 25;
  const { store } = createStore(state);

  await syncTikTokFinanceForOrder("order-1", {
    fetchFinance: async () => settledFinance,
    store,
  });

  // RM50 - RM5 tracker product revenue + RM44.30 TikTok settlement - RM20 COGS.
  // shipping_cost_amount and fee_and_tax_amount are already inside settlement.
  assert.equal(state.order.profit, 69.3);
});

test("FULL_TIKTOK settled profit is unaffected by catalogue selling-price changes", async () => {
  const state = makeState();
  state.items[0].sellPrice = 999;
  const { store } = createStore(state);

  await syncTikTokFinanceForOrder("order-1", {
    fetchFinance: async () => settledFinance,
    store,
  });

  assert.equal(state.order.profit, 24.3);
});

test("a later pending lookup retains already-settled values and status", async () => {
  const state = makeState();
  state.order.financeStatus = TikTokFinanceStatus.SETTLED;
  state.finance = { tiktokSettlementAmount: "44.30" };
  const { store, writes } = createStore(state);

  const result = await syncTikTokFinanceForOrder("order-1", {
    fetchFinance: async () => null,
    store,
  });

  assert.deepEqual(result, { financeStatus: TikTokFinanceStatus.SETTLED });
  assert.deepEqual(writes, []);
  assert.deepEqual(state.finance, { tiktokSettlementAmount: "44.30" });
});

test("Finance sync rejects manual orders and missing TikTok order IDs", async () => {
  const cases = [
    {
      source: "MANUAL" as const,
      tiktokOrderId: null,
      message: /only available for TikTok orders/i,
    },
    {
      source: "TIKTOK" as const,
      tiktokOrderId: null,
      message: /TikTok order ID is missing/i,
    },
  ];

  for (const scenario of cases) {
    let fetchCalls = 0;
    await assert.rejects(
      syncTikTokFinanceForOrder("order-1", {
        fetchFinance: async () => {
          fetchCalls += 1;
          return settledFinance;
        },
        store: {
          findById: async () => ({
            source: scenario.source,
            tiktokOrderId: scenario.tiktokOrderId,
            financeStatus: null,
            tiktokPaymentMode: null,
            subtotal: 0,
            discount: 0,
            items: [],
          }),
          markPending: async () => undefined,
          markSettled: async () => undefined,
        },
      }),
      (error: unknown) =>
        error instanceof AppError && scenario.message.test(error.message)
    );
    assert.equal(fetchCalls, 0);
  }
});
