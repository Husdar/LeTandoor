-- CreateEnum
CREATE TYPE "InsightKind" AS ENUM ('MANUEL', 'QUOTIDIEN');

-- AlterTable
ALTER TABLE "ai_insights" ADD COLUMN     "kind" "InsightKind" NOT NULL DEFAULT 'MANUEL';

-- CreateTable
CREATE TABLE "manual_revenue_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "label" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_revenue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manual_revenue_entries_date_idx" ON "manual_revenue_entries"("date");

-- AddForeignKey
ALTER TABLE "manual_revenue_entries" ADD CONSTRAINT "manual_revenue_entries_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

