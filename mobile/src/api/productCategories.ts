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