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

export type CreateProductInput = {
  name: string;
  sku: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  categoryId?: string | null;
};

export const getProducts = async (
  page = 1,
  limit = 20,
  search = ""
): Promise<ProductsResponse> => {
  const response = await apiClient.get("/products", {
    params: {
      page,
      limit,
      search,
    },
  });

  return {
    products: response.data.data,
    meta: response.data.meta,
  };
};

export const createProduct = async (data: CreateProductInput) => {
  const response = await apiClient.post("/products", data);
  return response.data.data;
};

export type UpdateProductInput = {
  name?: string;
  sku?: string;
  costPrice?: number;
  sellPrice?: number;
  stock?: number;
  categoryId?: string | null;
  isActive?: boolean;
};

export const getProductById = async (productId: string): Promise<Product> => {
  const response = await apiClient.get(`/products/${productId}`);
  return response.data.data;
};

export const updateProduct = async (
  productId: string,
  data: UpdateProductInput
) => {
  const response = await apiClient.put(`/products/${productId}`, data);
  return response.data.data;
};