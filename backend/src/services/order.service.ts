import prisma from "../lib/prisma";
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

    for (const item of data.items) {
      await tx.product.update({
        where: {
          id: item.productId,
        },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    return order;
  });
};

export const getAllOrders = async () => {
  return prisma.salesOrder.findMany({
    orderBy: {
      createdAt: "desc",
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
      for (const item of order.items) {
        await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              increment: item.quantity,
            },
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