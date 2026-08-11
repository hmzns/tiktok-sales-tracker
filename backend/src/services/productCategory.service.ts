import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";

type CreateProductCategoryInput = {
  name: string;
  description?: string;
  isActive?: boolean;
};

type UpdateProductCategoryInput = Partial<CreateProductCategoryInput>;

export const createProductCategory = async (
  data: CreateProductCategoryInput
) => {
  const existingCategory = await prisma.productCategory.findUnique({
    where: {
      name: data.name,
    },
  });

  if (existingCategory) {
    throw new AppError("Product category already exists", 409);
  }

  return prisma.productCategory.create({
    data: {
      name: data.name,
      description: data.description,
      isActive: data.isActive ?? true,
    },
  });
};

export const getAllProductCategories = async () => {
  return prisma.productCategory.findMany({
    orderBy: {
      name: "asc",
    },
  });
};

export const getProductCategoryById = async (id: string) => {
  return prisma.productCategory.findUnique({
    where: {
      id,
    },
    include: {
      products: true,
    },
  });
};

export const updateProductCategory = async (
  id: string,
  data: UpdateProductCategoryInput
) => {
  return prisma.productCategory.update({
    where: {
      id,
    },
    data,
  });
};

export const deleteProductCategory = async (id: string) => {
  return prisma.productCategory.delete({
    where: {
      id,
    },
  });
};