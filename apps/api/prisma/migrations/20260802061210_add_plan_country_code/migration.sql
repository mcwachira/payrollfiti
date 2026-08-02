-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN     "countryCode" TEXT;

-- CreateIndex
CREATE INDEX "Plan_countryCode_idx" ON "public"."Plan"("countryCode");
