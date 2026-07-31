import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import prisma from "../src/lib/prisma";
import {
  completeImportedOrder,
  type OrderTransactionRunner,
  updateOrderStatus,
} from "../src/services/order.service";
import { AppError } from "../src/utils/AppError";
import { completeImportedOrderSchema } from "../src/validators/order.validator";

type TestProduct = {
  id: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  isActive: boolean;
};

type TestOrder = {
  id: string;
  orderNumber: string | null;
  source: "MANUAL" | "TIKTOK";
  importStatus: "NEEDS_ITEMS" | "READY" | "IMPORT_FAILED";
  stockProcessed: boolean;
  discount: number;
  shippingFee: number;
  subtotal: number;
  total: number;
  totalCost: number;
  profit: number;
  rawImportData: Record<string, unknown>;
};

type TestOrderItem = {
  orderId: string;
  productId: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;
  lineTotal: number;
  lineCost: number;
  lineProfit: number;
};

type TestMovement = {
  productId: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reference: string;
  note: string;
};

type TestState = {
  order: TestOrder;
  products: TestProduct[];
  items: TestOrderItem[];
  movements: TestMovement[];
};

const makeOrder = (overrides: Partial<TestOrder> = {}): TestOrder => ({
  id: "order-1",
  orderNumber: "TT-1001",
  source: "TIKTOK",
  importStatus: "NEEDS_ITEMS",
  stockProcessed: false,
  discount: 1,
  shippingFee: 2,
  subtotal: 0,
  total: 0,
  totalCost: 0,
  profit: 0,
  rawImportData: { tiktokOrderId: "TT-1001", shopId: "shop-1" },
  ...overrides,
});

const makeProduct = (
  id: string,
  overrides: Partial<TestProduct> = {}
): TestProduct => ({
  id,
  name: `Product ${id}`,
  costPrice: 4,
  sellPrice: 10,
  stock: 10,
  isActive: true,
  ...overrides,
});

const cloneState = (state: TestState): TestState =>
  structuredClone(state) as TestState;

const createHarness = (
  initialState: TestState,
  failDeductionForProductId?: string
) => {
  let state = cloneState(initialState);

  const runTransaction: OrderTransactionRunner = async <T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>
  ) => {
    const working = cloneState(state);

    const tx = {
      salesOrder: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          working.order.id === where.id ? { ...working.order } : null,
        updateMany: async ({
          where,
          data,
        }: {
          where: {
            id: string;
            source: string;
            importStatus: string;
            stockProcessed: boolean;
          };
          data: Partial<TestOrder>;
        }) => {
          const matches =
            working.order.id === where.id &&
            working.order.source === where.source &&
            working.order.importStatus === where.importStatus &&
            working.order.stockProcessed === where.stockProcessed;

          if (matches) {
            Object.assign(working.order, data);
          }

          return { count: matches ? 1 : 0 };
        },
        update: async ({
          data,
        }: {
          where: { id: string };
          data: Partial<TestOrder>;
        }) => {
          Object.assign(working.order, data);

          const { rawImportData: _rawImportData, ...safeOrder } = working.order;
          return {
            ...safeOrder,
            items: working.items.map((item) => ({
              ...item,
              product: working.products.find(
                (product) => product.id === item.productId
              ),
            })),
          };
        },
      },
      product: {
        findMany: async ({
          where,
        }: {
          where: { id: { in: string[] } };
        }) =>
          working.products.filter((product) =>
            where.id.in.includes(product.id)
          ),
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; stock: { gte: number } };
          data: { stock: { decrement: number } };
        }) => {
          const product = working.products.find(
            (candidate) => candidate.id === where.id
          );
          const canDeduct =
            product &&
            product.id !== failDeductionForProductId &&
            product.stock >= where.stock.gte;

          if (product && canDeduct) {
            product.stock -= data.stock.decrement;
          }

          return { count: canDeduct ? 1 : 0 };
        },
        findUnique: async ({ where }: { where: { id: string } }) => {
          const product = working.products.find(
            (candidate) => candidate.id === where.id
          );
          return product ? { stock: product.stock } : null;
        },
      },
      orderItem: {
        createMany: async ({ data }: { data: TestOrderItem[] }) => {
          working.items.push(...data);
          return { count: data.length };
        },
      },
      stockMovement: {
        create: async ({ data }: { data: TestMovement }) => {
          working.movements.push(data);
          return data;
        },
      },
    } as unknown as Prisma.TransactionClient;

    const result = await callback(tx);
    state = working;
    return result;
  };

  return {
    runTransaction,
    getState: () => cloneState(state),
  };
};

test("completion validation rejects empty items, duplicates, and invalid prices", () => {
  assert.equal(
    completeImportedOrderSchema.safeParse({ items: [] }).success,
    false
  );
  assert.equal(
    completeImportedOrderSchema.safeParse({
      items: [
        { productId: "product-1", quantity: 1 },
        { productId: "product-1", quantity: 2 },
      ],
    }).success,
    false
  );
  assert.equal(
    completeImportedOrderSchema.safeParse({
      items: [{ productId: "product-1", quantity: 1, sellPrice: -1 }],
    }).success,
    false
  );
  assert.equal(
    completeImportedOrderSchema.safeParse({
      items: [{ productId: "product-1", quantity: 1, sellPrice: null }],
    }).success,
    false
  );
});

test("missing orders return a clear not-found error", async () => {
  const harness = createHarness({
    order: makeOrder(),
    products: [makeProduct("product-1")],
    items: [],
    movements: [],
  });

  await assert.rejects(
    completeImportedOrder(
      "missing-order",
      { items: [{ productId: "product-1", quantity: 1 }] },
      harness.runTransaction
    ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 404 &&
      error.message === "Order not found"
  );
});

test("completes a TikTok import with one item, totals, stock, and movement", async () => {
  const harness = createHarness({
    order: makeOrder(),
    products: [makeProduct("product-1")],
    items: [],
    movements: [],
  });

  const result = await completeImportedOrder(
    "order-1",
    { items: [{ productId: "product-1", quantity: 2 }] },
    harness.runTransaction
  );
  const state = harness.getState();

  assert.equal(state.items.length, 1);
  assert.equal(state.products[0].stock, 8);
  assert.deepEqual(state.movements, [
    {
      productId: "product-1",
      type: "SALE",
      quantity: -2,
      stockBefore: 10,
      stockAfter: 8,
      reference: "TT-1001",
      note: "Stock deducted for order TT-1001",
    },
  ]);
  assert.equal(state.order.subtotal, 20);
  assert.equal(state.order.total, 21);
  assert.equal(state.order.totalCost, 8);
  assert.equal(state.order.profit, 13);
  assert.equal(state.order.importStatus, "READY");
  assert.equal(state.order.stockProcessed, true);
  assert.equal("rawImportData" in (result as object), false);
  assert.equal((result as { items: unknown[] }).items.length, 1);
});

test("completes a TikTok import with multiple items and a sell-price override", async () => {
  const harness = createHarness({
    order: makeOrder({ discount: 0, shippingFee: 0 }),
    products: [
      makeProduct("product-1"),
      makeProduct("product-2", { costPrice: 3, sellPrice: 8, stock: 5 }),
    ],
    items: [],
    movements: [],
  });

  await completeImportedOrder(
    "order-1",
    {
      items: [
        { productId: "product-1", quantity: 2, sellPrice: 12 },
        { productId: "product-2", quantity: 3 },
      ],
    },
    harness.runTransaction
  );
  const state = harness.getState();

  assert.equal(state.items.length, 2);
  assert.deepEqual(
    state.products.map((product) => product.stock),
    [8, 2]
  );
  assert.equal(state.movements.length, 2);
  assert.equal(state.order.subtotal, 48);
  assert.equal(state.order.totalCost, 17);
  assert.equal(state.order.profit, 31);
});

test("insufficient stock rolls back items, stock, movements, and order state", async () => {
  const initialState: TestState = {
    order: makeOrder(),
    products: [makeProduct("product-1"), makeProduct("product-2")],
    items: [],
    movements: [],
  };
  const harness = createHarness(initialState, "product-2");

  await assert.rejects(
    completeImportedOrder(
      "order-1",
      {
        items: [
          { productId: "product-1", quantity: 2 },
          { productId: "product-2", quantity: 3 },
        ],
      },
      harness.runTransaction
    ),
    /Not enough stock/
  );

  assert.deepEqual(harness.getState(), initialState);
});

test("manual orders cannot use the import-completion service", async () => {
  const harness = createHarness({
    order: makeOrder({
      source: "MANUAL",
      importStatus: "READY",
      stockProcessed: true,
    }),
    products: [makeProduct("product-1")],
    items: [],
    movements: [],
  });

  await assert.rejects(
    completeImportedOrder(
      "order-1",
      { items: [{ productId: "product-1", quantity: 1 }] },
      harness.runTransaction
    ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      error.message === "Order is not an incomplete TikTok import"
  );
});

test("completed imports conflict and a repeated request cannot deduct twice", async () => {
  const harness = createHarness({
    order: makeOrder(),
    products: [makeProduct("product-1")],
    items: [],
    movements: [],
  });
  const input = { items: [{ productId: "product-1", quantity: 2 }] };

  await completeImportedOrder("order-1", input, harness.runTransaction);

  await assert.rejects(
    completeImportedOrder("order-1", input, harness.runTransaction),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      error.message === "Imported order has already been completed"
  );

  const state = harness.getState();
  assert.equal(state.products[0].stock, 8);
  assert.equal(state.items.length, 1);
  assert.equal(state.movements.length, 1);
});

test("completed imported order cancellation restores its deducted stock", async () => {
  const originalFindUnique = prisma.salesOrder.findUnique;
  const originalTransaction = prisma.$transaction;
  let stock = 8;
  const movements: Array<Record<string, unknown>> = [];
  const completedOrder = {
    id: "order-1",
    orderNumber: "TT-1001",
    source: "TIKTOK",
    importStatus: "READY",
    stockProcessed: true,
    status: "PAID",
    items: [{ productId: "product-1", quantity: 2 }],
  };

  const tx = {
    product: {
      update: async ({
        data,
      }: {
        data: { stock: { increment: number } };
      }) => {
        stock += data.stock.increment;
        return { stock };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        movements.push(data);
        return data;
      },
    },
    salesOrder: {
      update: async ({ data }: { data: { status: string } }) => ({
        ...completedOrder,
        status: data.status,
      }),
    },
  } as unknown as Prisma.TransactionClient;

  prisma.salesOrder.findUnique = (async () =>
    completedOrder) as unknown as typeof prisma.salesOrder.findUnique;
  prisma.$transaction = (async (
    callback: (transaction: Prisma.TransactionClient) => Promise<unknown>
  ) => callback(tx)) as typeof prisma.$transaction;

  try {
    await updateOrderStatus("order-1", "CANCELLED");
  } finally {
    prisma.salesOrder.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
  }

  assert.equal(stock, 10);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].type, "CANCEL_RESTORE");
  assert.equal(movements[0].quantity, 2);
});

test("incomplete imported order cancellation does not restore stock", async () => {
  const originalFindUnique = prisma.salesOrder.findUnique;
  const originalTransaction = prisma.$transaction;
  let restorationCalls = 0;
  const incompleteOrder = {
    id: "order-1",
    orderNumber: "TT-1001",
    source: "TIKTOK",
    importStatus: "NEEDS_ITEMS",
    stockProcessed: false,
    status: "PENDING",
    items: [{ productId: "product-1", quantity: 2 }],
  };

  const tx = {
    product: {
      update: async () => {
        restorationCalls += 1;
        return { stock: 10 };
      },
    },
    stockMovement: {
      create: async () => {
        restorationCalls += 1;
        return {};
      },
    },
    salesOrder: {
      update: async ({ data }: { data: { status: string } }) => ({
        ...incompleteOrder,
        status: data.status,
      }),
    },
  } as unknown as Prisma.TransactionClient;

  prisma.salesOrder.findUnique = (async () =>
    incompleteOrder) as unknown as typeof prisma.salesOrder.findUnique;
  prisma.$transaction = (async (
    callback: (transaction: Prisma.TransactionClient) => Promise<unknown>
  ) => callback(tx)) as typeof prisma.$transaction;

  try {
    await updateOrderStatus("order-1", "REFUNDED");
  } finally {
    prisma.salesOrder.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
  }

  assert.equal(restorationCalls, 0);
});
