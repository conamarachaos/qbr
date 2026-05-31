-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('open', 'in_progress', 'addressed', 'dismissed');

-- CreateTable
CREATE TABLE "Gap" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "qbrRunId" TEXT,
    "feature" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 3,
    "status" "GapStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gap_accountId_idx" ON "Gap"("accountId");

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
