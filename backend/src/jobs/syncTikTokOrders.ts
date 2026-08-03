import "dotenv/config";
import prisma from "../lib/prisma";
import type { TikTokOrderSyncSummary } from "../services/tiktokOrder.service";
import {
  getTikTokSyncErrorCategory,
  syncTikTokOrdersWithHistory,
  TikTokSyncSource,
} from "../services/tiktokSync.service";

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

type TikTokAutoSyncDependencies = {
  syncOrders: (
    days: number,
    source: TikTokSyncSource
  ) => Promise<TikTokOrderSyncSummary>;
  disconnect: () => Promise<void>;
  configuredDays: string | undefined;
  setExitCode: (code: number) => void;
};

export const getTikTokAutoSyncFailureCategory = getTikTokSyncErrorCategory;

export const runTikTokAutoSync = async (
  dependencyOverrides: Partial<TikTokAutoSyncDependencies> = {}
) => {
  const dependencies: TikTokAutoSyncDependencies = {
    syncOrders: syncTikTokOrdersWithHistory,
    disconnect: () => prisma.$disconnect(),
    configuredDays: process.env.TIKTOK_AUTO_SYNC_DAYS,
    setExitCode: (code) => {
      process.exitCode = code;
    },
    ...dependencyOverrides,
  };
  const days = getTikTokAutoSyncDays(dependencies.configuredDays);
  let summary: TikTokOrderSyncSummary | undefined;
  let failureCategory: string | undefined;

  console.info("tiktok_auto_sync_started", { days });

  try {
    summary = await dependencies.syncOrders(
      days,
      TikTokSyncSource.SCHEDULED
    );
  } catch (error) {
    failureCategory = getTikTokAutoSyncFailureCategory(error);
  } finally {
    try {
      await dependencies.disconnect();
    } catch {
      failureCategory ??= "DATABASE_ERROR";
    }
  }

  if (failureCategory || !summary) {
    console.error("tiktok_auto_sync_failed", {
      category: failureCategory ?? "unexpected_service_error",
    });
    dependencies.setExitCode(1);
    return;
  }

  console.info("tiktok_auto_sync_completed", {
    fetched: summary.fetched,
    created: summary.created,
    existing: summary.existing,
    failed: summary.failed,
  });
  dependencies.setExitCode(0);
};

if (require.main === module) {
  void runTikTokAutoSync();
}
