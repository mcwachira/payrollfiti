-- CreateTable
CREATE TABLE "public"."EmployeeInvite" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeInvite_employeeId_key" ON "public"."EmployeeInvite"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeInvite_tokenHash_key" ON "public"."EmployeeInvite"("tokenHash");

-- AddForeignKey
ALTER TABLE "public"."EmployeeInvite" ADD CONSTRAINT "EmployeeInvite_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
