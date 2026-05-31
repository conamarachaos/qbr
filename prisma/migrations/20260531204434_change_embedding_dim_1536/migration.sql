-- Switch embeddings provider from Voyage (1024) to OpenAI text-embedding-3-small (1536).
-- The ivfflat index is bound to the column type, so drop it, change the dimension
-- (clearing existing vectors — they are derived data and get re-indexed on re-seed
-- / next source-add / next run), then recreate the index.

DROP INDEX IF EXISTS "SourceChunk_embedding_idx";

-- No safe cast between differently-sized vectors; null them out so the column can
-- be re-typed. Rows are re-embedded by lib/repo/chunks.ts.
UPDATE "SourceChunk" SET "embedding" = NULL;

ALTER TABLE "SourceChunk" ALTER COLUMN "embedding" TYPE vector(1536);

CREATE INDEX "SourceChunk_embedding_idx" ON "public"."SourceChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
