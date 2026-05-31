-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('am', 'cs_lead', 'admin');

-- CreateEnum
CREATE TYPE "public"."Tier" AS ENUM ('strategic', 'growth', 'at_risk');

-- CreateEnum
CREATE TYPE "public"."Lifecycle" AS ENUM ('onboarding', 'active', 'renewal', 'churned');

-- CreateEnum
CREATE TYPE "public"."OwnershipRole" AS ENUM ('primary_am', 'secondary', 'exec_sponsor');

-- CreateEnum
CREATE TYPE "public"."ContactRole" AS ENUM ('champion', 'economic_buyer', 'user', 'detractor');

-- CreateEnum
CREATE TYPE "public"."SourceType" AS ENUM ('call', 'email', 'usage');

-- CreateEnum
CREATE TYPE "public"."HealthCategory" AS ENUM ('healthy', 'at_risk', 'critical');

-- CreateEnum
CREATE TYPE "public"."RunStatus" AS ENUM ('queued', 'running', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "public"."OppType" AS ENUM ('renewal', 'expansion', 'upsell');

-- CreateEnum
CREATE TYPE "public"."OppStage" AS ENUM ('identified', 'qualified', 'proposed', 'won', 'lost');

-- CreateEnum
CREATE TYPE "public"."ActionStatus" AS ENUM ('open', 'in_progress', 'done');

-- CreateTable
CREATE TABLE "public"."Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'am',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical" TEXT,
    "tier" "public"."Tier" NOT NULL DEFAULT 'growth',
    "arr" INTEGER,
    "renewalDate" TIMESTAMP(3),
    "lifecycle" "public"."Lifecycle" NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountOwnership" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."OwnershipRole" NOT NULL DEFAULT 'primary_am',

    CONSTRAINT "AccountOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "roleType" "public"."ContactRole" NOT NULL DEFAULT 'user',
    "email" TEXT,
    "lastEngagedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Source" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "public"."SourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsageSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HealthScore" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overall" INTEGER NOT NULL,
    "category" "public"."HealthCategory" NOT NULL,
    "components" JSONB NOT NULL,

    CONSTRAINT "HealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QbrRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "triggeredById" TEXT,
    "status" "public"."RunStatus" NOT NULL DEFAULT 'running',
    "period" TEXT,
    "modelMeta" JSONB,
    "usageTotals" JSONB,
    "stages" JSONB,
    "goals" JSONB,
    "usage" JSONB,
    "gaps" JSONB,
    "opportunities" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QbrRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Brief" (
    "id" TEXT NOT NULL,
    "qbrRunId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Opportunity" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "qbrRunId" TEXT,
    "feature" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "score" DOUBLE PRECISION,
    "type" "public"."OppType" NOT NULL DEFAULT 'expansion',
    "stage" "public"."OppStage" NOT NULL DEFAULT 'identified',
    "amount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActionItem" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "qbrRunId" TEXT,
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "public"."ActionStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."authenticators" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "authenticators_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "public"."Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "Account_workspaceId_idx" ON "public"."Account"("workspaceId");

-- CreateIndex
CREATE INDEX "AccountOwnership_userId_idx" ON "public"."AccountOwnership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountOwnership_accountId_userId_key" ON "public"."AccountOwnership"("accountId", "userId");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "public"."Contact"("accountId");

-- CreateIndex
CREATE INDEX "Source_accountId_idx" ON "public"."Source"("accountId");

-- CreateIndex
CREATE INDEX "UsageSnapshot_accountId_idx" ON "public"."UsageSnapshot"("accountId");

-- CreateIndex
CREATE INDEX "HealthScore_accountId_idx" ON "public"."HealthScore"("accountId");

-- CreateIndex
CREATE INDEX "QbrRun_accountId_idx" ON "public"."QbrRun"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Brief_qbrRunId_key" ON "public"."Brief"("qbrRunId");

-- CreateIndex
CREATE INDEX "Opportunity_accountId_idx" ON "public"."Opportunity"("accountId");

-- CreateIndex
CREATE INDEX "ActionItem_accountId_idx" ON "public"."ActionItem"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "public"."sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_providerAccountId_key" ON "public"."auth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "public"."verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "authenticators_credentialID_key" ON "public"."authenticators"("credentialID");

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountOwnership" ADD CONSTRAINT "AccountOwnership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountOwnership" ADD CONSTRAINT "AccountOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Source" ADD CONSTRAINT "Source_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsageSnapshot" ADD CONSTRAINT "UsageSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HealthScore" ADD CONSTRAINT "HealthScore_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QbrRun" ADD CONSTRAINT "QbrRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Brief" ADD CONSTRAINT "Brief_qbrRunId_fkey" FOREIGN KEY ("qbrRunId") REFERENCES "public"."QbrRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActionItem" ADD CONSTRAINT "ActionItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."authenticators" ADD CONSTRAINT "authenticators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
