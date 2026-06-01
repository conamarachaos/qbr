-- CreateEnum
CREATE TYPE "public"."GoalDecisionStatus" AS ENUM ('pending', 'confirmed', 'dismissed');

-- AlterTable
ALTER TABLE "public"."Gap" ADD COLUMN     "goalId" TEXT;

-- AlterTable
ALTER TABLE "public"."Opportunity" ADD COLUMN     "goalId" TEXT;

-- CreateTable
CREATE TABLE "public"."GoalDecision" (
    "id" TEXT NOT NULL,
    "qbrRunId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "status" "public"."GoalDecisionStatus" NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoalDecision_qbrRunId_idx" ON "public"."GoalDecision"("qbrRunId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalDecision_qbrRunId_goalId_key" ON "public"."GoalDecision"("qbrRunId", "goalId");

-- AddForeignKey
ALTER TABLE "public"."GoalDecision" ADD CONSTRAINT "GoalDecision_qbrRunId_fkey" FOREIGN KEY ("qbrRunId") REFERENCES "public"."QbrRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

