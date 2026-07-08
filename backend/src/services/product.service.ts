import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";

export const getAllProducts = async () => {
  return await prisma.product.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

// CREATE PRODUCT
export const createProduct = async (data: {
  name: string;
  sku: string;
  costPrice: number;
  sellPrice: number;
  stock?: number;
}) => {
  const existing = await prisma.product.findUnique({
    where: {
      sku: data.sku,
    },
  });

  if (existing) {
    throw new AppError("SKU already exists", 409);
  }

  return prisma.product.create({
    data: {
      name: data.name,
      sku: data.sku,
      costPrice: data.costPrice,
      sellPrice: data.sellPrice,
      stock: data.stock ?? 0,
    },
  });
};

// GET PRODUCT BY ID
export const getProductById = async (id: string) => {
  return prisma.product.findUnique({
    where: {
      id,
    },
  });
};

// UPDATE PRODUCT BY ID
export const updateProduct = async (
  id: string,
  data: {
    name?: string;
    sku?: string;
    costPrice?: number;
    sellPrice?: number;
    stock?: number;
    isActive?: boolean;
  }
) => {
  return prisma.product.update({
    where: {
      id,
    },
    data,
  });
}

// DELETE PRODUCT BY ID
export const deleteProduct = async (id: string) => {
  return prisma.product.delete({
    where: {
      id,
    },
  });
}