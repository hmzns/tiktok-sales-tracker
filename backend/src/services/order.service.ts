import prisma from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";

type CreateOrderInput = {
  orderNumber?: string;
  tiktokOrderId?: string;
  platform?: "MANUAL" | "TIKTOK_SHOP" | "SHOPEE" | "LAZADA";
  status?:
    | "PENDING"
    | "PAID"
    | "PACKING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED";
  customerName?: string;
  discount?: number;
  shippingFee?: number;
  items: {
    productId: string;
    quantity: number;
    sellPrice?: number;
  }[];
};

// POST /orders
export const createOrder = async (data: CreateOrderInput) => {
  const discount = data.discount ?? 0;
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

  const orderItemsData = data.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (!product.isActive) {
      throw new AppError(`${product.name} is inactive`, 400);
    }

    if (product.stock < item.quantity) {
      throw new AppError(`Not enough stock for ${product.name}`, 400);
    }

    const sellPrice = item.sellPrice ?? product.sellPrice;
    const costPrice = product.costPrice;

    const lineTotal = sellPrice * item.quantity;
    const lineCost = costPrice * item.quantity;
    const lineProfit = lineTotal - lineCost;

    return {
      productId: product.id,
      quantity: item.quantity,
      sellPrice,
      costPrice,
      lineTotal,
      lineCost,
      lineProfit,
    };
  });

  const subtotal = orderItemsData.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalCost = orderItemsData.reduce((sum, item) => sum + item.lineCost, 0);
  const total = subtotal - discount + shippingFee;
  const profit = total - totalCost;

  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.create({
      data: {
        orderNumber: data.orderNumber,
        tiktokOrderId: data.tiktokOrderId,
        platform: data.platform ?? "MANUAL",
        status: data.status ?? "PENDING",
        customerName: data.customerName,

        subtotal,
        discount,
        shippingFee,
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
    });

    for (const item of orderItemsData) {
      const updatedProduct = await tx.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
        select: {
          stock: true,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "SALE",
          quantity: -item.quantity,
          stockBefore: updatedProduct.stock + item.quantity,
          stockAfter: updatedProduct.stock,
          reference: order.orderNumber ?? order.id,
          note: `Stock deducted for order ${order.orderNumber ?? order.id}`,
        },
      });
    }

    return order;
  });
};

// GET /orders
type OrderFilter = {
  search?: string;
  status?:
    | "PENDING"
    | "PAID"
    | "PACKING"
    | "SHIPPED"
    | "DELIVERED"
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
  });
};

// PATCH /orders/:id/status
export const updateOrderStatus = async (
  id: string,
  status:
    | "PENDING"
    | "PAID"
    | "PACKING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED"
) => {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.status === status) {
    return order;
  }

  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    throw new AppError("Cancelled or refunded orders cannot be updated", 400);
  }

  const shouldRestoreStock = status === "CANCELLED" || status === "REFUNDED";

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
    });

    return updatedOrder;
  });
};