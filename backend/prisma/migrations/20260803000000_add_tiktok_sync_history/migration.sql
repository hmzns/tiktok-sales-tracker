-- CreateEnum
CREATE TYPE "TikTokSyncSource" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "TikTokSyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "TikTokSyncRun" (
    "id" TEXT NOT NULL,
    "source" "TikTokSyncSource" NOT NULL,
    "status" "TikTokSyncStatus" NOT NULL,
    "days" INTEGER NOT NULL,
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "existing" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorCategory" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,

    CONSTRAINT "TikTokSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TikTokSyncRun_completedAt_idx" ON "TikTokSyncRun"("completedAt" DESC);

-- CreateIndex
CREATE INDEX "TikTokSyncRun_status_completedAt_idx" ON "TikTokSyncRun"("status", "completedAt" DESC);
