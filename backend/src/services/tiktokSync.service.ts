import {
  Prisma,
  TikTokSyncSource,
  TikTokSyncStatus,
  type TikTokSyncRun,
} from "@prisma/client";
import { ZodError } from "zod";
import prisma from "../lib/prisma";
import { AppError } from "../utils/AppError";
import {
  syncTikTokOrders,
  type TikTokOrderSyncSummary,
} from "./tiktokOrder.service";

export type TikTokSyncErrorCategory =
  | "NOT_CONNECTED"
  | "SHOP_METADATA_MISSING"
  | "TOKEN_REFRESH_FAILED"
  | "TIKTOK_UNAVAILABLE"
  | "DATABASE_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export type SafeTikTokSyncRun = Pick<
  TikTokSyncRun,
  | "id"
  | "source"
  | "status"
  | "days"
  | "fetched"
  | "created"
  | "existing"
  | "failed"
  | "errorCategory"
  | "startedAt"
  | "completedAt"
  | "durationMs"
>;

export type TikTokSyncRunWrite = Omit<SafeTikTokSyncRun, "id">;

export type TikTokSyncHistoryWriter = {
  create: (data: TikTokSyncRunWrite) => Promise<unknown>;
};

export type TikTokSyncHistoryReader = {
  listNewest: (limit: number) => Promise<SafeTikTokSyncRun[]>;
  findLastSuccessful: () => Promise<SafeTikTokSyncRun | null>;
};

type TikTokSyncDependencies = {
  syncOrders: (days: number) => Promise<TikTokOrderSyncSummary>;
  historyWriter: TikTokSyncHistoryWriter;
  now: () => Date;
};

const safeTikTokSyncRunSelect = {
  id: true,
  source: true,
  status: true,
  days: true,
  fetched: true,
  created: true,
  existing: true,
  failed: true,
  errorCategory: true,
  startedAt: true,
  completedAt: true,
  durationMs: true,
} satisfies Prisma.TikTokSyncRunSelect;

const prismaHistoryWriter: TikTokSyncHistoryWriter = {
  create: (data) => prisma.tikTokSyncRun.create({ data }),
};

const prismaHistoryReader: TikTokSyncHistoryReader = {
  listNewest: (limit) =>
    prisma.tikTokSyncRun.findMany({
      select: safeTikTokSyncRunSelect,
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
  findLastSuccessful: () =>
    prisma.tikTokSyncRun.findFirst({
      select: safeTikTokSyncRunSelect,
      where: { status: TikTokSyncStatus.SUCCESS },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    }),
};

const isPrismaDatabaseError = (error: unknown) =>
  error instanceof Prisma.PrismaClientInitializationError ||
  error instanceof Prisma.PrismaClientKnownRequestError ||
  error instanceof Prisma.PrismaClientUnknownRequestError ||
  error instanceof Prisma.PrismaClientRustPanicError;

export const getTikTokSyncErrorCategory = (
  error: unknown
): TikTokSyncErrorCategory => {
  if (isPrismaDatabaseError(error)) {
    return "DATABASE_ERROR";
  }

  if (
    error instanceof ZodError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return "VALIDATION_ERROR";
  }

  if (!(error instanceof AppError)) {
    return "UNKNOWN";
  }

  const message = error.message.toLowerCase();

  if (message.includes("metadata must be synchronized")) {
    return "SHOP_METADATA_MISSING";
  }

  if (
    message.includes("not connected") ||
    message.includes("single tiktok shop connection") ||
    message.includes("connection could not be loaded")
  ) {
    return "NOT_CONNECTED";
  }

  if (
    message.includes("token") ||
    message.includes("tiktok_token_encryption_key")
  ) {
    return "TOKEN_REFRESH_FAILED";
  }

  if (
    message.includes("order api") ||
    message.includes("order-list") ||
    message.includes("order page") ||
    message.includes("order pagination") ||
    message.includes("unable to reach tiktok shop") ||
    message.includes("tiktok shop returned") ||
    message.includes("tiktok shop rejected")
  ) {
    return "TIKTOK_UNAVAILABLE";
  }

  if (
    message.includes("not configured") ||
    message.includes("must be a valid https url")
  ) {
    return "VALIDATION_ERROR";
  }

  return "UNKNOWN";
};

const getDurationMs = (startedAt: Date, completedAt: Date) =>
  Math.min(
    Math.max(completedAt.getTime() - startedAt.getTime(), 0),
    2_147_483_647
  );

const writeHistorySafely = async (
  writer: TikTokSyncHistoryWriter,
  data: TikTokSyncRunWrite
) => {
  try {
    await writer.create(data);
  } catch {
    console.error("tiktok_sync_history_write_failed");
  }
};

export const syncTikTokOrdersWithHistory = async (
  days: number,
  source: TikTokSyncSource,
  dependencyOverrides: Partial<TikTokSyncDependencies> = {}
): Promise<TikTokOrderSyncSummary> => {
  const dependencies: TikTokSyncDependencies = {
    syncOrders: syncTikTokOrders,
    historyWriter: prismaHistoryWriter,
    now: () => new Date(),
    ...dependencyOverrides,
  };
  const startedAt = dependencies.now();

  try {
    const summary = await dependencies.syncOrders(days);
    const completedAt = dependencies.now();

    await writeHistorySafely(dependencies.historyWriter, {
      source,
      status: TikTokSyncStatus.SUCCESS,
      days,
      ...summary,
      errorCategory: null,
      startedAt,
      completedAt,
      durationMs: getDurationMs(startedAt, completedAt),
    });

    return summary;
  } catch (error) {
    const completedAt = dependencies.now();

    await writeHistorySafely(dependencies.historyWriter, {
      source,
      status: TikTokSyncStatus.FAILED,
      days,
      fetched: 0,
      created: 0,
      existing: 0,
      failed: 0,
      errorCategory: getTikTokSyncErrorCategory(error),
      startedAt,
      completedAt,
      durationMs: getDurationMs(startedAt, completedAt),
    });

    throw error;
  }
};

export const getTikTokSyncHistory = async (
  limit: number,
  reader: TikTokSyncHistoryReader = prismaHistoryReader
) => {
  const [history, lastSuccessful] = await Promise.all([
    reader.listNewest(limit),
    reader.findLastSuccessful(),
  ]);
  const orderedHistory = [...history].sort(
    (left, right) =>
      right.completedAt.getTime() - left.completedAt.getTime() ||
      right.id.localeCompare(left.id)
  );

  return {
    lastAttempt: orderedHistory[0] ?? null,
    lastSuccessful,
    history: orderedHistory,
  };
};

export { TikTokSyncSource, TikTokSyncStatus };
