-- CreateEnum
CREATE TYPE "TikTokPaymentMode" AS ENUM ('FULL_TIKTOK', 'EXTERNAL_PRODUCT_PAYMENT');

-- CreateEnum
CREATE TYPE "TikTokFinanceStatus" AS ENUM ('PENDING', 'SETTLED', 'UNAVAILABLE', 'ERROR');

-- AlterTable
ALTER TABLE "SalesOrder"
ADD COLUMN "tiktokPaymentMode" "TikTokPaymentMode",
ADD COLUMN "buyerShippingFee" DECIMAL(18,2),
ADD COLUMN "financeStatus" "TikTokFinanceStatus",
ADD COLUMN "financeCurrency" TEXT,
ADD COLUMN "tiktokRevenueAmount" DECIMAL(18,2),
ADD COLUMN "tiktokShippingCostAmount" DECIMAL(18,2),
ADD COLUMN "tiktokFeeAndTaxAmount" DECIMAL(18,2),
ADD COLUMN "tiktokSettlementAmount" DECIMAL(18,2),
ADD COLUMN "financeSyncedAt" TIMESTAMP(3);
