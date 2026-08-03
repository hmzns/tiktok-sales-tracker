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

export type OrderSource = "MANUAL" | "TIKTOK";

export type ImportStatus = "NEEDS_ITEMS" | "READY" | "IMPORT_FAILED";

export type SalesOrder = {
  id: string;
  orderNumber: string | null;
  tiktokOrderId: string | null;
  source: OrderSource;
  importStatus: ImportStatus;
  stockProcessed: boolean;
  importedAt: string | null;
  platform: string;
  status: OrderStatus;
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

export type Order = SalesOrder;

export type OrdersResponse = {
  orders: SalesOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type TikTokOrderSyncResponse = {
  success: boolean;
  data: {
    fetched: number;
    created: number;
    existing: number;
    failed: number;
  };
};

export type TikTokSyncSource = "MANUAL" | "SCHEDULED";

export type TikTokSyncStatus = "SUCCESS" | "FAILED";

export type TikTokSyncErrorCategory =
  | "NOT_CONNECTED"
  | "SHOP_METADATA_MISSING"
  | "TOKEN_REFRESH_FAILED"
  | "TIKTOK_UNAVAILABLE"
  | "DATABASE_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export type TikTokSyncRun = {
  id: string;
  source: TikTokSyncSource;
  status: TikTokSyncStatus;
  days: number;
  fetched: number;
  created: number;
  existing: number;
  failed: number;
  errorCategory: TikTokSyncErrorCategory | null;
  startedAt: string;
  completedAt: string;
  durationMs: number | null;
};

export type TikTokSyncHistoryResponse = {
  success: true;
  data: {
    lastAttempt: TikTokSyncRun | null;
    lastSuccessful: TikTokSyncRun | null;
    history: TikTokSyncRun[];
  };
};

export type TikTokSyncHistory = TikTokSyncHistoryResponse["data"];

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

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export const createOrder = async (data: CreateOrderInput) => {
  const response = await apiClient.post("/orders", data);
  return response.data.data;
};

export const getOrders = async (
  page = 1,
  limit = 20,
  search = "",
  status: OrderStatus | "ALL" = "ALL"
): Promise<OrdersResponse> => {
  const params: Record<string, string | number> = {
    page,
    limit,
  };

  if (search.trim()) {
    params.search = search.trim();
  }

  if (status !== "ALL") {
    params.status = status;
  }

  const response = await apiClient.get("/orders", {
    params,
  });

  return {
    orders: response.data.data,
    meta: response.data.meta,
  };
};

const ALL_ORDERS_PAGE_SIZE = 100;

export const getAllOrders = async (search = ""): Promise<SalesOrder[]> => {
  const firstPage = await getOrders(1, ALL_ORDERS_PAGE_SIZE, search);

  if (firstPage.meta.totalPages <= 1) {
    return firstPage.orders;
  }

  const remainingPages = await Promise.all(
    Array.from(
      { length: firstPage.meta.totalPages - 1 },
      (_, index) => getOrders(index + 2, ALL_ORDERS_PAGE_SIZE, search)
    )
  );

  const uniqueOrders = new Map<string, SalesOrder>();

  [firstPage, ...remainingPages].forEach((page) => {
    page.orders.forEach((order) => uniqueOrders.set(order.id, order));
  });

  return Array.from(uniqueOrders.values());
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus
) => {
  const response = await apiClient.patch(`/orders/${orderId}/status`, {
    status,
  });

  return response.data.data;
};

export const getOrderById = async (
  orderId: string
): Promise<SalesOrder> => {
  const response = await apiClient.get(`/orders/${orderId}`);
  return response.data.data;
};

export const syncTikTokOrders = async (
  days = 7
): Promise<TikTokOrderSyncResponse> => {
  const response = await apiClient.post<TikTokOrderSyncResponse>(
    "/tiktok-shop/orders/sync",
    { days },
    {
      timeout: 90000,
    }
  );

  return response.data;
};

export const getTikTokSyncHistory = async (
  limit = 10
): Promise<TikTokSyncHistoryResponse> => {
  const response = await apiClient.get<TikTokSyncHistoryResponse>(
    "/tiktok-shop/sync-history",
    { params: { limit } }
  );

  return response.data;
};

export const completeImportedOrder = async (
  salesOrderId: string,
  items: {
    productId: string;
    quantity: number;
  }[]
): Promise<SalesOrder> => {
  const response = await apiClient.post(
    `/orders/${salesOrderId}/complete-import`,
    { items }
  );

  return response.data.data;
};
