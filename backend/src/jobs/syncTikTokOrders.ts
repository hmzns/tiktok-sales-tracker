import "dotenv/config";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { syncTikTokOrders } from "../services/tiktokOrder.service";
import { AppError } from "../utils/AppError";

const DEFAULT_AUTO_SYNC_DAYS = 2;
const MIN_AUTO_SYNC_DAYS = 1;
const MAX_AUTO_SYNC_DAYS = 30;

export const getTikTokAutoSyncDays = (value: string | undefined) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue || !/^\d+$/.test(trimmedValue)) {
    return DEFAULT_AUTO_SYNC_DAYS;
  }

  const days = Number(trimmedValue);

  return Number.isInteger(days) &&
    days >= MIN_AUTO_SYNC_DAYS &&
    days <= MAX_AUTO_SYNC_DAYS
    ? days
    : DEFAULT_AUTO_SYNC_DAYS;
};

export const getTikTokAutoSyncFailureCategory = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "database_connection_failed";
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return "database_operation_failed";
  }

  if (!(error instanceof AppError)) {
    return "unexpected_service_error";
  }

  if (error.message.includes("metadata must be synchronized")) {
    return "tiktok_shop_metadata_missing";
  }

  if (
    error.message.includes("connection") ||
    error.message.includes("TikTok Shop is not connected")
  ) {
    return "tiktok_connection_unavailable";
  }

  if (
    error.message.includes("token") ||
    error.message.includes("TIKTOK_TOKEN_ENCRYPTION_KEY")
  ) {
    return "tiktok_token_refresh_failed";
  }

  if (
    error.message.includes("order API") ||
    error.message.includes("order-list") ||
    error.message.includes("order page") ||
    error.message.includes("order pagination")
  ) {
    return "tiktok_api_unavailable";
  }

  if (error.message.includes("TikTok Shop is not configured")) {
    return "tiktok_configuration_invalid";
  }

  return "tiktok_sync_failed";
};

export const runTikTokAutoSync = async () => {
  const days = getTikTokAutoSyncDays(process.env.TIKTOK_AUTO_SYNC_DAYS);
  let summary: Awaited<ReturnType<typeof syncTikTokOrders>> | undefined;
  let failureCategory: string | undefined;

  console.info("tiktok_auto_sync_started", { days });

  try {
    summary = await syncTikTokOrders(days);
  } catch (error) {
    failureCategory = getTikTokAutoSyncFailureCategory(error);
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      failureCategory ??= "database_disconnect_failed";
    }
  }

  if (failureCategory || !summary) {
    console.error("tiktok_auto_sync_failed", {
      category: failureCategory ?? "unexpected_service_error",
    });
    process.exitCode = 1;
    return;
  }

  console.info("tiktok_auto_sync_completed", {
    fetched: summary.fetched,
    created: summary.created,
    existing: summary.existing,
    failed: summary.failed,
  });
  process.exitCode = 0;
};

if (require.main === module) {
  void runTikTokAutoSync();
}
