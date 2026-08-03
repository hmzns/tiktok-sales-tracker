import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { generateTikTokShopSignature } from "../utils/tiktokShopSignature";
import { getTikTokOrderApiContext } from "./tiktokShop.service";

const TIKTOK_ORDER_LIST_PATH = "/order/202309/orders/search";
const TIKTOK_ORDER_PAGE_SIZE = 100;
const MAX_TIKTOK_ORDER_PAGES = 100;
const API_REQUEST_TIMEOUT_MS = 15_000;
const FALLBACK_CUSTOMER_NAME = "TikTok Customer";

const paymentValueSchema = z.union([z.string(), z.number()]).nullable();

const tiktokOrderSchema = z.object({
  id: z.string().trim().min(1),
  status: z.string().nullable().optional(),
  create_time: z.number().int().nonnegative().nullable().optional(),
  update_time: z.number().int().nonnegative().nullable().optional(),
  recipient_address: z
    .object({
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  payment: z
    .object({
      currency: z.string().nullable().optional(),
      sub_total: paymentValueSchema.optional(),
      shipping_fee: paymentValueSchema.optional(),
      seller_discount: paymentValueSchema.optional(),
      platform_discount: paymentValueSchema.optional(),
      total_amount: paymentValueSchema.optional(),
    })
    .nullable()
    .optional(),
});

const tiktokOrderListResponseSchema = z.object({
  code: z.coerce.number().int(),
  data: z
    .object({
      orders: z.array(tiktokOrderSchema),
      next_page_token: z.string().nullable().optional(),
    })
    .optional(),
});

export type TikTokOrder = z.infer<typeof tiktokOrderSchema>;

type TikTokOrderPage = {
  orders: TikTokOrder[];
  nextPageToken?: string;
};

type BasicTikTokOrderCreateData = {
  orderNumber: string;
  tiktokOrderId: string;
  source: "TIKTOK";
  importStatus: "NEEDS_ITEMS";
  importedAt: Date;
  rawImportData: Prisma.InputJsonObject;
  stockProcessed: false;
  platform: "TIKTOK_SHOP";
  customerName: string;
  subtotal: 0;
  discount: 0;
  shippingFee: 0;
  total: 0;
  totalCost: 0;
  profit: 0;
};

export type TikTokOrderStore = {
  findByTikTokOrderId: (
    tiktokOrderId: string
  ) => Promise<{ id: string } | null>;
  createBasicOrder: (
    data: BasicTikTokOrderCreateData
  ) => Promise<{ id: string }>;
};

export type TikTokOrderSyncSummary = {
  fetched: number;
  created: number;
  existing: number;
  failed: number;
};

type ImportBasicTikTokOrderInput = {
  order: TikTokOrder;
  shopId: string | null;
  importedAt: Date;
  store: TikTokOrderStore;
  isUniqueConstraintError?: (error: unknown) => boolean;
};

const toSafeText = (
  value: string | null | undefined,
  maximumLength: number
) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maximumLength) : undefined;
};

const toSafePaymentValue = (
  value: string | number | null | undefined
) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  return toSafeText(value, 64);
};

export const sanitizeTikTokOrderMetadata = (
  order: TikTokOrder,
  shopId: string | null
) => {
  const metadata: Record<string, Prisma.InputJsonValue> = {
    tiktokOrderId: order.id,
  };
  const status = toSafeText(order.status, 64);
  const currency = toSafeText(order.payment?.currency, 16);
  const paymentSummary = {
    subTotal: toSafePaymentValue(order.payment?.sub_total),
    shippingFee: toSafePaymentValue(order.payment?.shipping_fee),
    sellerDiscount: toSafePaymentValue(order.payment?.seller_discount),
    platformDiscount: toSafePaymentValue(order.payment?.platform_discount),
    totalAmount: toSafePaymentValue(order.payment?.total_amount),
  };
  const safePaymentSummary = Object.fromEntries(
    Object.entries(paymentSummary).filter(([, value]) => value !== undefined)
  );

  if (status) metadata.status = status;
  if (order.create_time != null) {
    metadata.createTime = order.create_time;
  }
  if (order.update_time != null) {
    metadata.updateTime = order.update_time;
  }
  if (currency) metadata.currency = currency;
  if (Object.keys(safePaymentSummary).length > 0) {
    metadata.paymentSummary = safePaymentSummary;
  }
  if (shopId) metadata.shopId = shopId;

  return metadata;
};

export const buildBasicTikTokOrderData = (
  order: TikTokOrder,
  shopId: string | null,
  importedAt: Date
): BasicTikTokOrderCreateData => ({
  orderNumber: order.id,
  tiktokOrderId: order.id,
  source: "TIKTOK",
  importStatus: "NEEDS_ITEMS",
  importedAt,
  rawImportData: sanitizeTikTokOrderMetadata(order, shopId),
  stockProcessed: false,
  platform: "TIKTOK_SHOP",
  customerName:
    toSafeText(order.recipient_address?.name, 200) ??
    FALLBACK_CUSTOMER_NAME,
  subtotal: 0,
  discount: 0,
  shippingFee: 0,
  total: 0,
  totalCost: 0,
  profit: 0,
});

const isPrismaUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const importBasicTikTokOrder = async ({
  order,
  shopId,
  importedAt,
  store,
  isUniqueConstraintError = isPrismaUniqueConstraintError,
}: ImportBasicTikTokOrderInput): Promise<"created" | "existing"> => {
  const existing = await store.findByTikTokOrderId(order.id);

  if (existing) {
    // Existing imports may have been completed or edited manually. Treat them
    // as immutable during synchronization.
    return "existing";
  }

  try {
    await store.createBasicOrder(
      buildBasicTikTokOrderData(order, shopId, importedAt)
    );
    return "created";
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    // A concurrent sync may have inserted this TikTok order after our check.
    const concurrentlyCreated = await store.findByTikTokOrderId(order.id);
    if (!concurrentlyCreated) {
      throw error;
    }

    return "existing";
  }
};

export const collectTikTokOrderPages = async (
  requestPage: (
    pageToken: string | undefined,
    pageNumber: number
  ) => Promise<TikTokOrderPage>,
  maximumPages = MAX_TIKTOK_ORDER_PAGES
) => {
  const orders: TikTokOrder[] = [];
  const seenPageTokens = new Set<string>();
  let pageToken: string | undefined;

  for (let pageNumber = 1; pageNumber <= maximumPages; pageNumber += 1) {
    const page = await requestPage(pageToken, pageNumber);
    orders.push(...page.orders);

    const nextPageToken = page.nextPageToken?.trim() || undefined;
    if (!nextPageToken) {
      return orders;
    }

    if (seenPageTokens.has(nextPageToken)) {
      throw new AppError(
        "TikTok Shop returned a repeated order page token",
        502
      );
    }

    seenPageTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }

  throw new AppError(
    "TikTok Shop order pagination exceeded the safety limit",
    502
  );
};

const requestTikTokOrderPage = async ({
  appKey,
  appSecret,
  apiBaseUrl,
  accessToken,
  shopCipher,
  createTimeGe,
  createTimeLt,
  pageToken,
}: {
  appKey: string;
  appSecret: string;
  apiBaseUrl: string;
  accessToken: string;
  shopCipher: string;
  createTimeGe: number;
  createTimeLt: number;
  pageToken: string | undefined;
}): Promise<TikTokOrderPage> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = {
    create_time_ge: createTimeGe,
    create_time_lt: createTimeLt,
  };
  const queryParams = {
    app_key: appKey,
    timestamp,
    shop_cipher: shopCipher,
    page_size: TIKTOK_ORDER_PAGE_SIZE,
    sort_field: "create_time",
    sort_order: "ASC",
    page_token: pageToken,
  };
  const sign = generateTikTokShopSignature({
    appSecret,
    method: "POST",
    path: TIKTOK_ORDER_LIST_PATH,
    queryParams,
    body,
  });
  const url = new URL(TIKTOK_ORDER_LIST_PATH, apiBaseUrl);

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set("sign", sign);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppError("Unable to reach TikTok Shop order API", 502);
  }

  let responseData: unknown;

  try {
    responseData = await response.json();
  } catch {
    throw new AppError(
      "TikTok Shop returned an invalid order-list response",
      502
    );
  }

  const parsed = tiktokOrderListResponseSchema.safeParse(responseData);

  if (
    !response.ok ||
    !parsed.success ||
    parsed.data.code !== 0 ||
    !parsed.data.data
  ) {
    throw new AppError("TikTok Shop rejected the order-list request", 502);
  }

  return {
    orders: parsed.data.data.orders,
    nextPageToken: parsed.data.data.next_page_token ?? undefined,
  };
};

const prismaTikTokOrderStore: TikTokOrderStore = {
  findByTikTokOrderId: (tiktokOrderId) =>
    prisma.salesOrder.findUnique({
      where: { tiktokOrderId },
      select: { id: true },
    }),
  createBasicOrder: (data) =>
    prisma.salesOrder.create({
      data,
      select: { id: true },
    }),
};

export const syncTikTokOrders = async (
  days: number
): Promise<TikTokOrderSyncSummary> => {
  console.info("tiktok_order_sync_started", { days });

  const syncTime = new Date();
  const createTimeLt = Math.floor(syncTime.getTime() / 1000);
  const createTimeGe = createTimeLt - days * 24 * 60 * 60;
  let context: Awaited<ReturnType<typeof getTikTokOrderApiContext>>;
  let orders: TikTokOrder[];

  try {
    context = await getTikTokOrderApiContext();
    orders = await collectTikTokOrderPages((pageToken) =>
      requestTikTokOrderPage({
        ...context,
        createTimeGe,
        createTimeLt,
        pageToken,
      })
    );
  } catch (error) {
    console.error("tiktok_order_sync_api_failed", { days });
    throw error;
  }

  const summary = {
    fetched: orders.length,
    created: 0,
    existing: 0,
    failed: 0,
  };

  for (const order of orders) {
    try {
      const result = await importBasicTikTokOrder({
        order,
        shopId: context.shopId,
        importedAt: syncTime,
        store: prismaTikTokOrderStore,
      });
      summary[result] += 1;
    } catch {
      summary.failed += 1;
      console.error("tiktok_order_import_failed", {
        tiktokOrderId: order.id,
      });
    }
  }

  console.info("tiktok_order_sync_completed", summary);
  return summary;
};

export const tikTokOrderListApiPath = TIKTOK_ORDER_LIST_PATH;
