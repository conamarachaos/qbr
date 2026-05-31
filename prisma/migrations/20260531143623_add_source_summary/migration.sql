-- DropIndex
DROP INDEX "public"."SourceChunk_embedding_idx";

-- AlterTable
ALTER TABLE "public"."Source" ADD COLUMN     "summary" JSONB,
ADD COLUMN     "summaryAt" TIMESTAMP(3);
