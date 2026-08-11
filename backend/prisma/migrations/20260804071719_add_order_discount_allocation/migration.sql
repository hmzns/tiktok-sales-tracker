-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "allocatedDiscount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
