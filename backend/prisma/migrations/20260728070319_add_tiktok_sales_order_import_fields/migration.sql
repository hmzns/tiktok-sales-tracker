-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'TIKTOK');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('NEEDS_ITEMS', 'READY', 'IMPORT_FAILED');

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "importStatus" "ImportStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "rawImportData" JSONB,
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "stockProcessed" BOOLEAN NOT NULL DEFAULT false;

-- Existing orders were created through the manual flow, which deducts stock
-- during creation. Preserve that inventory state while new records retain the
-- false database default required for incomplete imports.
UPDATE "SalesOrder" SET "stockProcessed" = true;
