-- CreateEnum
CREATE TYPE "public"."LoanStatus" AS ENUM ('PENDING', 'REJECTED', 'ACTIVE', 'PAID_OFF');

-- CreateEnum
CREATE TYPE "public"."LoanRepaymentStatus" AS ENUM ('PENDING', 'PAID', 'SKIPPED');

-- CreateTable
CREATE TABLE "public"."Loan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "principal" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "installments" INTEGER NOT NULL,
    "installmentAmount" DOUBLE PRECISION,
    "startPeriod" TEXT NOT NULL,
    "reason" TEXT,
    "status" "public"."LoanStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "public"."LoanRepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payrollEntryId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_tenantId_idx" ON "public"."Loan"("tenantId");

-- CreateIndex
CREATE INDEX "Loan_employeeId_idx" ON "public"."Loan"("employeeId");

-- CreateIndex
CREATE INDEX "Loan_employeeId_status_idx" ON "public"."Loan"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LoanRepayment_loanId_idx" ON "public"."LoanRepayment"("loanId");

-- CreateIndex
CREATE INDEX "LoanRepayment_period_status_idx" ON "public"."LoanRepayment"("period", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoanRepayment_loanId_installmentNo_key" ON "public"."LoanRepayment"("loanId", "installmentNo");

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Loan" ADD CONSTRAINT "Loan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "public"."Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoanRepayment" ADD CONSTRAINT "LoanRepayment_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "public"."PayrollEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
