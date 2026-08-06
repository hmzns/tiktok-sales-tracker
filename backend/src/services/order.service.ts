import prisma from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  allocateDiscountCents,
  fromMoneyCents,
  roundMoney,
  toMoneyCents,
} from "../utils/orderFinancials";

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

const buildOrderFinancials = (
  items: CompleteImportedOrderInput["items"],
  products: OrderProduct[],
  discountInput: OrderDiscountInput | number | undefined,
  shippingFee: number
) => {
  const productsById = new Map(
    products.map((product) => [product.id, product])
  );

  // Snapshot prices on each order item so later product price changes do not
  // rewrite the order's historical revenue, cost, or profit.
  const orderItemsData = items.map((item) => {
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

    const rawSellPrice = item.sellPrice ?? product.sellPrice;

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
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.source !== "TIKTOK") {
      throw new AppError("Order is not an incomplete TikTok import", 409);
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
    } = buildOrderFinancials(
      data.items,
      products,
      data.discount,
      order.shippingFee
    );

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
