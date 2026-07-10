import { apiClient } from "./client";

export type Product = {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  isActive: boolean;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  } | null;
};

export type ProductsResponse = {
  products: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export const getProducts = async (
  page = 1,
  limit = 20
): Promise<ProductsResponse> => {
  const response = await apiClient.get("/products", {
    params: {
      page,
      limit,
    },
  });

  return {
    products: response.data.data,
    meta: response.data.meta,
  };
};