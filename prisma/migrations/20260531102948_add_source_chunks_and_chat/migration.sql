-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "public"."ChatRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "public"."SourceChunk" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "public"."ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceChunk_accountId_idx" ON "public"."SourceChunk"("accountId");

-- CreateIndex
CREATE INDEX "SourceChunk_sourceId_idx" ON "public"."SourceChunk"("sourceId");

-- CreateIndex
CREATE INDEX "ChatMessage_accountId_idx" ON "public"."ChatMessage"("accountId");

-- AddForeignKey
ALTER TABLE "public"."SourceChunk" ADD CONSTRAINT "SourceChunk_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SourceChunk" ADD CONSTRAINT "SourceChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Approximate-nearest-neighbour index for cosine similarity search over chunk
-- embeddings (queried via $queryRaw `embedding <=> $1::vector` in lib/repo/chunks.ts).
CREATE INDEX "SourceChunk_embedding_idx" ON "public"."SourceChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
