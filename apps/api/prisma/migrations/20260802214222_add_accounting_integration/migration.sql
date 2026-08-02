-- CreateEnum
CREATE TYPE "public"."AccountingProviderType" AS ENUM ('QUICKBOOKS', 'XERO', 'ZOHO_BOOKS');

-- CreateTable
CREATE TABLE "public"."AccountingIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "public"."AccountingProviderType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingIntegration_tenantId_key" ON "public"."AccountingIntegration"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."AccountingIntegration" ADD CONSTRAINT "AccountingIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
