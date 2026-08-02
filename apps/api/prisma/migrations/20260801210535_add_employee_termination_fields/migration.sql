-- AlterTable
ALTER TABLE "public"."Employee" ADD COLUMN     "terminatedAt" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT;
