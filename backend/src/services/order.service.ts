import prisma from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  allocateDiscountCents,
  fromMoneyCents,
  roundMoney,
  toMoneyCents,
} from "../utils/orderFinancials";
import { calculateTikTokOrderProfit } from "../utils/tiktokAccounting";

export type OrderDiscountInput = {
  type: "NONE" | "FIXED" | "PERCENTAGE";
  value: number;
};

type CreateOrderInput = {
  orderNumber?: string;
  tiktokOrderId?: string;
  platform?: "MANUAL" | "TIKTOK_SHOP" | "SHOPEE" | "LAZADA";
  status?:
    | "NEEDS_ITEMS"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED";
  customerName?: string;
  discount?: OrderDiscountInput | number;
  shippingFee?: number;
  items: {
    productId: string;
    quantity: number;
    sellPrice?: number;
  }[];
};

type CompleteImportedOrderInput = {
  paymentMode: "FULL_TIKTOK" | "EXTERNAL_PRODUCT_PAYMENT";
  discount?: OrderDiscountInput | number;
  items: {
    productId: string;
    quantity: number;
    sellPrice?: number;
  }[];
};

type OrderProduct = {
  id: string;
  name: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  isActive: boolean;
};

export type OrderTransactionRunner = <T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

const COMPLETE_IMPORTED_ORDER_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 20_000,
} as const;

const publicOrderOmit = {
  rawImportData: true,
} satisfies Prisma.SalesOrderOmit;

const isTikTokPaymentMode = (
  value: unknown
): value is "FULL_TIKTOK" | "EXTERNAL_PRODUCT_PAYMENT" =>
  value === "FULL_TIKTOK" || value === "EXTERNAL_PRODUCT_PAYMENT";

const normalizeDiscountInput = (
  discount: OrderDiscountInput | number | undefined
): OrderDiscountInput => {
  if (typeof discount === "number") {
    return {
      type: discount === 0 ? "NONE" : "FIXED",
      value: discount,
    };
  }

  return discount ?? { type: "NONE", value: 0 };
};

const buildOrderItemSnapshots = (
  items: CompleteImportedOrderInput["items"],
  products: OrderProduct[],
  useTrackerPricing: boolean
) => {
  const productsById = new Map(
    products.map((product) => [product.id, product])
  );

  if (items.length === 0) {
    throw new AppError("Order must have at least one item", 400);
  }

  return items.map((item) => {
    const product = productsById.get(item.productId);

    if (!product) {
      throw new AppError("One or more products were not found", 404);
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError("Quantity must be a positive whole number", 400);
    }

    if (!product.isActive) {
      throw new AppError(`${product.name} is inactive`, 400);
    }

    if (product.stock < item.quantity) {
      throw new AppError(`Not enough stock for ${product.name}`, 400);
    }

    const rawSellPrice = useTrackerPricing
      ? item.sellPrice ?? product.sellPrice
      : 0;

    if (!Number.isFinite(rawSellPrice) || rawSellPrice < 0) {
      throw new AppError("Sell price must be a non-negative number", 400);
    }

    if (!Number.isFinite(product.costPrice) || product.costPrice < 0) {
      throw new AppError("Product cost must be a non-negative number", 400);
    }

    const sellPrice = roundMoney(rawSellPrice);
    const costPrice = roundMoney(product.costPrice);
    const lineTotalCents = toMoneyCents(sellPrice * item.quantity);
    const lineCostCents = toMoneyCents(costPrice * item.quantity);

    return {
      productId: product.id,
      quantity: item.quantity,
      sellPrice,
      costPrice,
      lineTotalCents,
      lineCostCents,
    };
  });
};

const buildOrderFinancials = (
  items: CompleteImportedOrderInput["items"],
  products: OrderProduct[],
  discountInput: OrderDiscountInput | number | undefined,
  shippingFee: number
) => {
  // Snapshot tracker prices for manual/external-payment revenue and costs so
  // later catalogue edits do not rewrite historical tracker financials.
  const orderItemsData = buildOrderItemSnapshots(items, products, true);

  const subtotalCents = orderItemsData.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0
  );

  if (subtotalCents <= 0) {
    throw new AppError("Order subtotal must be greater than zero", 400);
  }

  const discount = normalizeDiscountInput(discountInput);

  if (!Number.isFinite(discount.value) || discount.value < 0) {
    throw new AppError("Discount value must be a non-negative number", 400);
  }

  let discountCents = 0;
  let discountValue = discount.value;

  if (discount.type === "NONE") {
    if (discount.value !== 0) {
      throw new AppError("No Discount value must be zero", 400);
    }

    discountValue = 0;
  } else if (discount.type === "FIXED") {
    discountValue = roundMoney(discount.value);
    discountCents = toMoneyCents(discountValue);
  } else if (discount.type === "PERCENTAGE") {
    if (discount.value > 100) {
      throw new AppError("Discount percentage cannot exceed 100", 400);
    }

    discountCents = Math.round((subtotalCents * discount.value) / 100);
  } else {
    throw new AppError("Invalid discount type", 400);
  }

  if (discountCents > subtotalCents) {
    throw new AppError("Fixed discount cannot exceed the order subtotal", 400);
  }

  if (!Number.isFinite(shippingFee) || shippingFee < 0) {
    throw new AppError("Shipping fee must be a non-negative number", 400);
  }

  const allocatedDiscountCents = allocateDiscountCents(
    orderItemsData.map((item) => item.lineTotalCents),
    discountCents
  );
  const finalizedOrderItems = orderItemsData.map((item, index) => {
    const allocatedDiscount = allocatedDiscountCents[index];
    const lineNetRevenueCents = item.lineTotalCents - allocatedDiscount;

    return {
      productId: item.productId,
      quantity: item.quantity,
      sellPrice: item.sellPrice,
      costPrice: item.costPrice,
      lineTotal: fromMoneyCents(item.lineTotalCents),
      allocatedDiscount: fromMoneyCents(allocatedDiscount),
      lineCost: fromMoneyCents(item.lineCostCents),
      lineProfit: fromMoneyCents(lineNetRevenueCents - item.lineCostCents),
    };
  });
  const totalCostCents = orderItemsData.reduce(
    (sum, item) => sum + item.lineCostCents,
    0
  );
  const shippingFeeCents = toMoneyCents(roundMoney(shippingFee));
  const totalCents = subtotalCents - discountCents + shippingFeeCents;

  return {
    orderItemsData: finalizedOrderItems,
    subtotal: fromMoneyCents(subtotalCents),
    discountType: discount.type,
    discountValue,
    discount: fromMoneyCents(discountCents),
    shippingFee: fromMoneyCents(shippingFeeCents),
    totalCost: fromMoneyCents(totalCostCents),
    total: fromMoneyCents(totalCents),
    profit: fromMoneyCents(totalCents - totalCostCents),
  };
};

const buildFullTikTokInventoryCompletion = (
  items: CompleteImportedOrderInput["items"],
  products: OrderProduct[]
) => {
  // FULL_TIKTOK completion establishes product identity, quantity, and COGS.
  // Catalogue sell prices are deliberately excluded because TikTok Finance is
  // authoritative for the order's revenue and final profit.
  const snapshots = buildOrderItemSnapshots(items, products, false);
  const totalCostCents = snapshots.reduce(
    (sum, item) => sum + item.lineCostCents,
    0
  );

  return {
    orderItemsData: snapshots.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      sellPrice: 0,
      costPrice: item.costPrice,
      lineTotal: 0,
      allocatedDiscount: null,
      lineCost: fromMoneyCents(item.lineCostCents),
      lineProfit: 0,
    })),
    subtotal: 0,
    discountType: "NONE" as const,
    discountValue: 0,
    discount: 0,
    shippingFee: 0,
    totalCost: fromMoneyCents(totalCostCents),
    total: 0,
    profit: null,
  };
};

const deductStockForOrderItem = async (
  tx: Prisma.TransactionClient,
  item: { productId: string; quantity: number },
  productName: string,
  orderReference: string
) => {
  // The conditional decrement keeps the stock check valid even when another
  // order is deducting this product concurrently.
  const stockUpdate = await tx.product.updateMany({
    where: {
      id: item.productId,
      stock: {
        gte: item.quantity,
      },
    },
    data: {
      stock: {
        decrement: item.quantity,
      },
    },
  });

  if (stockUpdate.count !== 1) {
    throw new AppError(`Not enough stock for ${productName}`, 400);
  }

  const updatedProduct = await tx.product.findUnique({
    where: { id: item.productId },
    select: { stock: true },
  });

  if (!updatedProduct) {
    throw new AppError("Product not found", 404);
  }

  await tx.stockMovement.create({
    data: {
      productId: item.productId,
      type: "SALE",
      quantity: -item.quantity,
      stockBefore: updatedProduct.stock + item.quantity,
      stockAfter: updatedProduct.stock,
      reference: orderReference,
      note: `Stock deducted for order ${orderReference}`,
    },
  });
};

// POST /orders
export const createOrder = async (data: CreateOrderInput) => {
  const shippingFee = data.shippingFee ?? 0;

  const productIds = data.items.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
  });

  if (products.length !== productIds.length) {
    throw new AppError("One or more products were not found", 404);
  }

  const {
    orderItemsData,
    subtotal,
    totalCost,
    total,
    profit,
    discountType,
    discountValue,
    discount,
    shippingFee: calculatedShippingFee,
  } = buildOrderFinancials(data.items, products, data.discount, shippingFee);

  // The order, stock deductions, and movement audit records must succeed or
  // fail together to keep inventory consistent with sales.
  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.create({
      data: {
        orderNumber: data.orderNumber,
        tiktokOrderId: data.tiktokOrderId,
        source: "MANUAL",
        stockProcessed: true,
        platform: data.platform ?? "MANUAL",
        status: data.status ?? "COMPLETED",
        customerName: data.customerName,

        subtotal,
        discountType,
        discountValue,
        discount,
        shippingFee: calculatedShippingFee,
        total,
        totalCost,
        profit,

        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      omit: publicOrderOmit,
    });

    for (const item of orderItemsData) {
      const product = products.find(
        (candidate) => candidate.id === item.productId
      );
      await deductStockForOrderItem(
        tx,
        item,
        product?.name ?? "product",
        order.orderNumber ?? order.id
      );
    }

    return order;
  });
};

// POST /orders/:id/complete-import
export const completeImportedOrder = async (
  id: string,
  data: CompleteImportedOrderInput,
  runTransaction: OrderTransactionRunner = (callback) =>
    prisma.$transaction(
      callback,
      COMPLETE_IMPORTED_ORDER_TRANSACTION_OPTIONS
    )
) => {
  return runTransaction(async (tx) => {
    const order = await tx.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        source: true,
        status: true,
        stockProcessed: true,
        shippingFee: true,
        financeStatus: true,
        tiktokSettlementAmount: true,
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.source !== "TIKTOK") {
      throw new AppError("Order is not an incomplete TikTok import", 409);
    }

    if (!isTikTokPaymentMode(data.paymentMode)) {
      throw new AppError("TikTok payment mode is required", 400);
    }

    if (order.status === "COMPLETED") {
      throw new AppError("Imported order has already been completed", 409);
    }

    if (order.stockProcessed) {
      throw new AppError("Order stock has already been processed", 409);
    }

    if (order.status !== "NEEDS_ITEMS") {
      throw new AppError("Order is not an incomplete TikTok import", 409);
    }

    const requestedDiscount = normalizeDiscountInput(data.discount);
    if (
      data.paymentMode === "FULL_TIKTOK" &&
      (requestedDiscount.type !== "NONE" || requestedDiscount.value !== 0)
    ) {
      throw new AppError(
        "Manual discounts are not available for fully TikTok-paid orders",
        400
      );
    }

    // Claim the order inside the transaction. Concurrent requests cannot both
    // change the same false flag, and a later failure rolls this change back.
    const claimedOrder = await tx.salesOrder.updateMany({
      where: {
        id,
        source: "TIKTOK",
        status: "NEEDS_ITEMS",
        stockProcessed: false,
      },
      data: {
        stockProcessed: true,
      },
    });

    if (claimedOrder.count !== 1) {
      throw new AppError(
        "Imported order is already being or has been completed",
        409
      );
    }

    const productIds = data.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new AppError("One or more products were not found", 404);
    }

    const completion =
      data.paymentMode === "FULL_TIKTOK"
        ? buildFullTikTokInventoryCompletion(data.items, products)
        : buildOrderFinancials(
            data.items,
            products,
            data.discount,
            order.shippingFee
          );
    const {
      orderItemsData,
      subtotal,
      totalCost,
      total,
      discountType,
      discountValue,
      discount,
      shippingFee: calculatedShippingFee,
    } = completion;
    const hasSettledFinance =
      order.financeStatus === "SETTLED" &&
      order.tiktokSettlementAmount !== null;
    const profit = calculateTikTokOrderProfit({
      paymentMode: data.paymentMode,
      financeStatus: order.financeStatus,
      settlementAmount: order.tiktokSettlementAmount,
      subtotal,
      discount,
      items: orderItemsData,
    });

    await tx.orderItem.createMany({
      data: orderItemsData.map((item) => ({
        orderId: order.id,
        ...item,
      })),
    });

    const orderReference = order.orderNumber ?? order.id;

    for (const item of orderItemsData) {
      const product = products.find(
        (candidate) => candidate.id === item.productId
      );
      await deductStockForOrderItem(
        tx,
        item,
        product?.name ?? "product",
        orderReference
      );
    }

    return tx.salesOrder.update({
      where: { id },
      data: {
        subtotal,
        discountType,
        discountValue,
        discount,
        shippingFee: calculatedShippingFee,
        total,
        totalCost,
        profit,
        tiktokPaymentMode: data.paymentMode,
        financeStatus:
          data.paymentMode === "FULL_TIKTOK" && !hasSettledFinance
            ? "PENDING"
            : order.financeStatus,
        status: "COMPLETED",
        stockProcessed: true,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      omit: publicOrderOmit,
    });
  });
};

// PATCH /orders/:id/tiktok-payment-mode
export const updateTikTokPaymentMode = async (
  id: string,
  paymentMode: "FULL_TIKTOK" | "EXTERNAL_PRODUCT_PAYMENT"
) => {
  if (!isTikTokPaymentMode(paymentMode)) {
    throw new AppError("Invalid TikTok payment mode", 400);
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      source: true,
      financeStatus: true,
      tiktokSettlementAmount: true,
      subtotal: true,
      discount: true,
      items: {
        select: {
          quantity: true,
          costPrice: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.source !== "TIKTOK") {
    throw new AppError("Payment mode can only be set for TikTok orders", 409);
  }

  const profit = calculateTikTokOrderProfit({
    paymentMode,
    financeStatus: order.financeStatus,
    settlementAmount: order.tiktokSettlementAmount,
    subtotal: order.subtotal,
    discount: order.discount,
    items: order.items,
  });

  return prisma.salesOrder.update({
    where: { id },
    data: { tiktokPaymentMode: paymentMode, profit },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    omit: publicOrderOmit,
  });
};

// GET /orders
type OrderFilter = {
  search?: string;
  status?:
    | "NEEDS_ITEMS"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED";
  platform?: "MANUAL" | "TIKTOK_SHOP" | "SHOPEE" | "LAZADA";
  page?: number;
  limit?: number;
};

export const getAllOrders = async (filter: OrderFilter = {}) => {
  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;
  const skip = (page - 1) * limit;

  const where: Prisma.SalesOrderWhereInput = {};

  if (filter.search) {
    where.OR = [
      {
        orderNumber: {
          contains: filter.search,
          mode: "insensitive",
        },
      },
      {
        tiktokOrderId: {
          contains: filter.search,
          mode: "insensitive",
        },
      },
      {
        customerName: {
          contains: filter.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.platform) {
    where.platform = filter.platform;
  }

  const [orders, total] = await prisma.$transaction([
    prisma.salesOrder.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      omit: publicOrderOmit,
    }),
    prisma.salesOrder.count({
      where,
    }),
  ]);

  return {
    orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

// GET /orders/:id
export const getOrderById = async (id: string) => {
  return prisma.salesOrder.findUnique({
    where: {
      id,
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    omit: publicOrderOmit,
  });
};

// PATCH /orders/:id/status
export const updateOrderStatus = async (
  id: string,
  status:
    | "NEEDS_ITEMS"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED"
) => {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      items: true,
    },
    omit: publicOrderOmit,
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.status === status) {
    return order;
  }

  // Terminal states also prove stock was already restored, preventing a
  // second status update from restoring the same items twice.
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    throw new AppError("Cancelled or refunded orders cannot be updated", 400);
  }

  const shouldRestoreStock =
    (status === "CANCELLED" || status === "REFUNDED") &&
    order.stockProcessed;

  return prisma.$transaction(async (tx) => {
    if (shouldRestoreStock) {
      const restoreType =
      status === "CANCELLED" ? "CANCEL_RESTORE" : "REFUND_RESTORE";

      for (const item of order.items) {
        const updatedProduct = await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
          select: {
            stock: true,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: restoreType,
            quantity: item.quantity,
            stockBefore: updatedProduct.stock - item.quantity,
            stockAfter: updatedProduct.stock,
            reference: order.orderNumber ?? order.id,
            note: `Stock restored because order was ${status.toLowerCase()}`,
          },
        });
      }
    }

    const updatedOrder = await tx.salesOrder.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      omit: publicOrderOmit,
    });

    return updatedOrder;
  });
};
