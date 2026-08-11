import { apiClient } from "./client";

export type StockMovementType =
  | "RESTOCK"
  | "SALE"
  | "CANCEL_RESTORE"
  | "REFUND_RESTORE"
  | "MANUAL_IN"
  | "MANUAL_OUT"
  | "DAMAGE";

export type StockMovement = {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  reference: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
};

export type StockMovementsResponse = {
  movements: StockMovement[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type AdjustStockInput = {
  productId: string;
  type: "RESTOCK" | "MANUAL_IN" | "MANUAL_OUT" | "DAMAGE";
  quantity: number;
  note?: string;
  reference?: string;
};

export const getStockMovements = async (
  page = 1,
  limit = 20
): Promise<StockMovementsResponse> => {
  const response = await apiClient.get("/stock-movements", {
    params: {
      page,
      limit,
    },
  });

  return {
    movements: response.data.data,
    meta: response.data.meta,
  };
};

export const adjustStock = async (data: AdjustStockInput) => {
  const response = await apiClient.post("/stock-movements/adjust", data);
  return response.data.data;
};