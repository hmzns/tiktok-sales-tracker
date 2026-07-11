import { apiClient } from "./client";

export type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;
  lineTotal: number;
  lineCost: number;
  lineProfit: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
};

export type Order = {
  id: string;
  orderNumber: string | null;
  tiktokOrderId: string | null;
  platform: string;
  status: string;
  customerName: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  totalCost: number;
  profit: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type OrdersResponse = {
  orders: Order[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type CreateOrderInput = {
  orderNumber?: string;
  platform?: "MANUAL" | "TIKTOK_SHOP" | "SHOPEE" | "LAZADA";
  status?: "PENDING" | "PAID" | "PACKING" | "SHIPPED" | "DELIVERED";
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
  const response = await apiClient.post("/orders", data);
  return response.data.data;
};

export const getOrders = async (
  page = 1,
  limit = 20
): Promise<OrdersResponse> => {
  const response = await apiClient.get("/orders", {
    params: {
      page,
      limit,
    },
  });

  return {
    orders: response.data.data,
    meta: response.data.meta,
  };
};