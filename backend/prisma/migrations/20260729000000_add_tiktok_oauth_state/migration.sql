-- CreateTable
CREATE TABLE "TikTokOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TikTokOAuthState_stateHash_key" ON "TikTokOAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "TikTokOAuthState_expiresAt_idx" ON "TikTokOAuthState"("expiresAt");
