import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";

type AdjustStockInput = {
  productId: string;
  type: "RESTOCK" | "MANUAL_IN" | "MANUAL_OUT" | "DAMAGE";
  quantity: number;
  note?: string;
  reference?: string;
};

type StockMovementFilter = {
  productId?: string;
  type?:
    | "RESTOCK"
    | "SALE"
    | "CANCEL_RESTORE"
    | "REFUND_RESTORE"
    | "MANUAL_IN"
    | "MANUAL_OUT"
    | "DAMAGE";
  page?: number;
  limit?: number;
};

export const adjustStock = async (data: AdjustStockInput) => {
  const product = await prisma.product.findUnique({
    where: {
      id: data.productId,
    },
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const isStockIn = data.type === "RESTOCK" || data.type === "MANUAL_IN";

  const movementQuantity = isStockIn ? data.quantity : -data.quantity;
  const stockBefore = product.stock;
  const stockAfter = stockBefore + movementQuantity;

  if (stockAfter < 0) {
    throw new AppError("Not enough stock for this adjustment", 400);
  }

  return prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: {
        id: data.productId,
      },
      data: {
        stock: stockAfter,
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: movementQuantity,
        stockBefore,
        stockAfter,
        note: data.note,
        reference: data.reference,
      },
      include: {
        product: true,
      },
    });

    return {
      product: updatedProduct,
      movement,
    };
  });
};

export const getAllStockMovements = async (
  filter: StockMovementFilter = {}
) => {
  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;
  const skip = (page - 1) * limit;

  const where: Prisma.StockMovementWhereInput = {};

  if (filter.productId) {
    where.productId = filter.productId;
  }

  if (filter.type) {
    where.type = filter.type;
  }

  const [movements, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      include: {
        product: true,
      },
    }),
    prisma.stockMovement.count({
      where,
    }),
  ]);

  return {
    movements,
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