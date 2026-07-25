-- CreateEnum
CREATE TYPE "public"."SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "public"."SalaryComponentCalcType" AS ENUM ('FIXED', 'PERCENTAGE_OF_BASIC');

-- AlterTable
ALTER TABLE "public"."PayrollRun" ADD COLUMN     "isOffCycle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "public"."SalaryComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."SalaryComponentType" NOT NULL,
    "calcType" "public"."SalaryComponentCalcType" NOT NULL DEFAULT 'FIXED',
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultAmount" DOUBLE PRECISION,
    "defaultRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalaryStructureComponent" (
    "id" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "salaryComponentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryStructureComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollCorrection" (
    "id" TEXT NOT NULL,
    "originalEntryId" TEXT NOT NULL,
    "correctedEntryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryComponent_tenantId_idx" ON "public"."SalaryComponent"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_tenantId_code_key" ON "public"."SalaryComponent"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SalaryStructureComponent_salaryStructureId_idx" ON "public"."SalaryStructureComponent"("salaryStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureComponent_salaryStructureId_salaryComponentI_key" ON "public"."SalaryStructureComponent"("salaryStructureId", "salaryComponentId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollCorrection_correctedEntryId_key" ON "public"."PayrollCorrection"("correctedEntryId");

-- CreateIndex
CREATE INDEX "PayrollCorrection_originalEntryId_idx" ON "public"."PayrollCorrection"("originalEntryId");

-- AddForeignKey
ALTER TABLE "public"."SalaryComponent" ADD CONSTRAINT "SalaryComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalaryStructureComponent" ADD CONSTRAINT "SalaryStructureComponent_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "public"."SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalaryStructureComponent" ADD CONSTRAINT "SalaryStructureComponent_salaryComponentId_fkey" FOREIGN KEY ("salaryComponentId") REFERENCES "public"."SalaryComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_originalEntryId_fkey" FOREIGN KEY ("originalEntryId") REFERENCES "public"."PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_correctedEntryId_fkey" FOREIGN KEY ("correctedEntryId") REFERENCES "public"."PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
