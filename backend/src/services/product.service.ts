import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";

type ProductFilter = {
  search?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
};

// GET /products
export const getAllProducts = async (filter: ProductFilter) => {
  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filter.search) {
    where.OR = [
      {
        name: {
          contains: filter.search,
          mode: "insensitive",
        },
      },
      {
        sku: {
          contains: filter.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (filter.isActive !== undefined) {
    where.isActive = filter.isActive;
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.product.count({
      where,
    }),
  ]);

  return {
    products,
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

// GET LOW STOCK PRODUCTS
export const getLowStockProducts = async (threshold: number) => {
  return prisma.product.findMany({
    where: {
      stock: {
        lte: threshold,
      },
      isActive: true,
    },
    orderBy: {
      stock: "asc",
    },
  });
};