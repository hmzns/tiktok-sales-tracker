import { apiClient } from "./client";

export type ProductCategory = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export const getProductCategories = async (): Promise<ProductCategory[]> => {
  const response = await apiClient.get("/product-categories");
  return response.data.data;
};

export type CreateProductCategoryInput = {
  name: string;
  description?: string;
};

export const createProductCategory = async (
  data: CreateProductCategoryInput
): Promise<ProductCategory> => {
  const response = await apiClient.post("/product-categories", data);
  return response.data.data;
};