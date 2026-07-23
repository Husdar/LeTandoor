-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUEL', 'SITE_WEB');

-- CreateEnum
CREATE TYPE "EmailIngestStatus" AS ENUM ('TRAITE', 'ECHEC', 'IGNORE');

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_menuItemId_fkey";

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "menuItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'MANUEL';

-- CreateTable
CREATE TABLE "email_ingest_logs" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "EmailIngestStatus" NOT NULL,
    "errorMessage" TEXT,
    "rawText" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_ingest_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_ingest_logs_messageId_key" ON "email_ingest_logs"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "email_ingest_logs_orderId_key" ON "email_ingest_logs"("orderId");

-- CreateIndex
CREATE INDEX "email_ingest_logs_status_idx" ON "email_ingest_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_externalRef_key" ON "orders"("externalRef");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_ingest_logs" ADD CONSTRAINT "email_ingest_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

