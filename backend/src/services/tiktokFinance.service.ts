import { TikTokFinanceStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { generateTikTokShopSignature } from "../utils/tiktokShopSignature";
import { calculateTikTokOrderProfit } from "../utils/tiktokAccounting";
import { getTikTokOrderApiContext } from "./tiktokShop.service";

const TIKTOK_ORDER_FINANCE_PATH_PREFIX = "/finance/202501/orders";
const API_REQUEST_TIMEOUT_MS = 15_000;

const financeAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^[+-]?\d+(?:\.\d+)?$/.test(value), {
    message: "Invalid finance amount",
  });

const tiktokOrderFinanceDataSchema = z.object({
  currency: z.string().trim().min(1).max(16),
  revenue_amount: financeAmountSchema,
  shipping_cost_amount: financeAmountSchema,
  fee_and_tax_amount: financeAmountSchema,
  settlement_amount: financeAmountSchema,
});

const tiktokOrderFinanceResponseSchema = z.object({
  code: z.coerce.number().int(),
  data: tiktokOrderFinanceDataSchema.nullish(),
});

export type TikTokOrderFinanceData = {
  currency: string;
  revenueAmount: string;
  shippingCostAmount: string;
  feeAndTaxAmount: string;
  settlementAmount: string;
};

export type TikTokFinanceFetcher = (
  tiktokOrderId: string
) => Promise<TikTokOrderFinanceData | null>;

export const parseTikTokOrderFinanceResponse = (
  responseData: unknown
): TikTokOrderFinanceData | null => {
  const parsed = tiktokOrderFinanceResponseSchema.safeParse(responseData);

  if (!parsed.success || parsed.data.code !== 0) {
    throw new AppError("Unable to retrieve TikTok finance data", 502);
  }

  if (!parsed.data.data) {
    return null;
  }

  return {
    currency: parsed.data.data.currency.toUpperCase(),
    revenueAmount: parsed.data.data.revenue_amount,
    shippingCostAmount: parsed.data.data.shipping_cost_amount,
    feeAndTaxAmount: parsed.data.data.fee_and_tax_amount,
    settlementAmount: parsed.data.data.settlement_amount,
  };
};

type FinanceOrderRecord = {
  source: "MANUAL" | "TIKTOK";
  tiktokOrderId: string | null;
  financeStatus: TikTokFinanceStatus | null;
  tiktokPaymentMode: "FULL_TIKTOK" | "EXTERNAL_PRODUCT_PAYMENT" | null;
  subtotal: number;
  discount: number;
  items: Array<{ quantity: number; costPrice: number }>;
};

type SettledFinanceWrite = {
  financeStatus: typeof TikTokFinanceStatus.SETTLED;
  financeCurrency: string;
  tiktokRevenueAmount: string;
  tiktokShippingCostAmount: string;
  tiktokFeeAndTaxAmount: string;
  tiktokSettlementAmount: string;
  financeSyncedAt: Date;
  profit: number | null;
};

export type TikTokFinanceOrderStore = {
  findById: (id: string) => Promise<FinanceOrderRecord | null>;
  markPending: (id: string, profit: number | null | undefined) => Promise<unknown>;
  markSettled: (id: string, data: SettledFinanceWrite) => Promise<unknown>;
};

type TikTokFinanceSyncDependencies = {
  fetchFinance: TikTokFinanceFetcher;
  store: TikTokFinanceOrderStore;
  now: () => Date;
};

const prismaFinanceOrderStore: TikTokFinanceOrderStore = {
  findById: (id) =>
    prisma.salesOrder.findUnique({
      where: { id },
      select: {
        source: true,
        tiktokOrderId: true,
        financeStatus: true,
        tiktokPaymentMode: true,
        subtotal: true,
        discount: true,
        items: {
          select: {
            quantity: true,
            costPrice: true,
          },
        },
      },
    }),
  markPending: (id, profit) =>
    prisma.salesOrder.update({
      where: { id },
      data: {
        financeStatus: TikTokFinanceStatus.PENDING,
        ...(profit !== undefined ? { profit } : {}),
      },
      select: { id: true },
    }),
  markSettled: (id, data) =>
    prisma.salesOrder.update({
      where: { id },
      data,
      select: { id: true },
    }),
};

const toFinancePath = (tiktokOrderId: string) =>
  `${TIKTOK_ORDER_FINANCE_PATH_PREFIX}/${encodeURIComponent(
    tiktokOrderId
  )}/statement_transactions`;

export const requestTikTokOrderFinance: TikTokFinanceFetcher = async (
  tiktokOrderId
) => {
  const context = await getTikTokOrderApiContext();
  const path = toFinancePath(tiktokOrderId);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const queryParams = {
    app_key: context.appKey,
    timestamp,
    shop_cipher: context.shopCipher,
  };
  const sign = generateTikTokShopSignature({
    appSecret: context.appSecret,
    method: "GET",
    path,
    queryParams,
  });
  const url = new URL(path, context.apiBaseUrl);

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("sign", sign);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": context.accessToken,
      },
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppError("Unable to retrieve TikTok finance data", 502);
  }

  if (response.status === 404) {
    return null;
  }

  let responseData: unknown;

  try {
    responseData = await response.json();
  } catch {
    throw new AppError("Unable to retrieve TikTok finance data", 502);
  }

  if (!response.ok) {
    throw new AppError("Unable to retrieve TikTok finance data", 502);
  }

  return parseTikTokOrderFinanceResponse(responseData);
};

export const syncTikTokFinanceForOrder = async (
  id: string,
  dependencyOverrides: Partial<TikTokFinanceSyncDependencies> = {}
) => {
  const dependencies: TikTokFinanceSyncDependencies = {
    fetchFinance: requestTikTokOrderFinance,
    store: prismaFinanceOrderStore,
    now: () => new Date(),
    ...dependencyOverrides,
  };
  const order = await dependencies.store.findById(id);

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.source !== "TIKTOK") {
    throw new AppError("TikTok finance is only available for TikTok orders", 409);
  }

  if (!order.tiktokOrderId) {
    throw new AppError("TikTok order ID is missing", 409);
  }

  const finance = await dependencies.fetchFinance(order.tiktokOrderId);

  if (!finance) {
    if (order.financeStatus !== TikTokFinanceStatus.SETTLED) {
      await dependencies.store.markPending(
        id,
        order.tiktokPaymentMode === "FULL_TIKTOK" ? null : undefined
      );
    }

    return {
      financeStatus:
        order.financeStatus === TikTokFinanceStatus.SETTLED
          ? TikTokFinanceStatus.SETTLED
          : TikTokFinanceStatus.PENDING,
    };
  }

  const profit = order.tiktokPaymentMode
    ? calculateTikTokOrderProfit({
        paymentMode: order.tiktokPaymentMode,
        financeStatus: TikTokFinanceStatus.SETTLED,
        settlementAmount: finance.settlementAmount,
        subtotal: order.subtotal,
        discount: order.discount,
        items: order.items,
      })
    : null;

  await dependencies.store.markSettled(id, {
    financeStatus: TikTokFinanceStatus.SETTLED,
    financeCurrency: finance.currency,
    tiktokRevenueAmount: finance.revenueAmount,
    // Preserve TikTok's signed shipping_cost_amount exactly. It is not an
    // absolute cost and is not buyer-paid shipping revenue.
    tiktokShippingCostAmount: finance.shippingCostAmount,
    tiktokFeeAndTaxAmount: finance.feeAndTaxAmount,
    tiktokSettlementAmount: finance.settlementAmount,
    financeSyncedAt: dependencies.now(),
    // settlement_amount is already net of TikTok shipping, fees, and taxes.
    // Never add or subtract those breakdown fields again.
    profit,
  });

  return { financeStatus: TikTokFinanceStatus.SETTLED };
};

export const tikTokOrderFinanceApiPath =
  "/finance/202501/orders/{order_id}/statement_transactions";
