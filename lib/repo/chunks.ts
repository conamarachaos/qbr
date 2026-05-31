import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { embedQuery, embedTexts, toVectorLiteral } from "@/lib/embeddings";
import { buildAccountAccessWhere } from "@/lib/repo/access";
import { type DbClient, type SessionContext } from "@/lib/repo/types";

/**
 * Indexing + retrieval over `SourceChunk`. The `embedding` column is a pgvector
 * `vector(1536)` that Prisma models as `Unsupported`, so every read/write of it
 * goes through raw SQL here. All access is scoped by `buildAccountAccessWhere`
 * (session-derived) — callers never pass a trusted account through.
 */

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

/**
 * Split text into overlapping windows on paragraph boundaries where possible.
 * Keeps chunks near CHUNK_SIZE chars so a quote stays inside one chunk, which is
 * what the grounding verifier later checks against.
 */
export function chunkText(
  content: string,
  { size = CHUNK_SIZE, overlap = CHUNK_OVERLAP }: { size?: number; overlap?: number } = {},
): string[] {
  const text = content.trim();
  if (!text) {
    return [];
  }
  if (text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + size, text.length);

    // Prefer to break on a paragraph/sentence boundary inside the window.
    if (end < text.length) {
      const slice = text.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
      );
      if (breakAt > size * 0.5) {
        end = start + breakAt + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) {
      break;
    }
    start = end - overlap;
  }

  return chunks.filter(Boolean);
}

async function assertAccountAccess(
  context: SessionContext,
  accountId: string,
  db: DbClient,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, accountId),
    select: { id: true },
  });
  if (!account) {
    throw new Error("Account not found.");
  }
  return account.id;
}

/**
 * (Re)index every source on an account: chunk → embed → replace SourceChunk rows.
 * Idempotent per source (deletes existing chunks first). Safe to call repeatedly.
 */
export async function indexAccountSources(
  context: SessionContext,
  accountId: string,
  db: DbClient = prisma,
) {
  const id = await assertAccountAccess(context, accountId, db);

  const sources = await db.source.findMany({
    where: { accountId: id },
    select: { id: true, content: true },
  });

  let indexed = 0;
  for (const source of sources) {
    indexed += await indexSource(id, source.id, source.content, db);
  }
  return { sources: sources.length, chunks: indexed };
}

/** Replace one source's chunks. Returns the number of chunks written. */
async function indexSource(
  accountId: string,
  sourceId: string,
  content: string,
  db: DbClient,
): Promise<number> {
  const chunks = chunkText(content);

  await db.sourceChunk.deleteMany({ where: { sourceId } });
  if (chunks.length === 0) {
    return 0;
  }

  const embeddings = await embedTexts(chunks);

  // The vector column is Unsupported in Prisma, so insert via parameterized raw SQL.
  for (let i = 0; i < chunks.length; i += 1) {
    const literal = toVectorLiteral(embeddings[i]);
    await db.$executeRaw`
      INSERT INTO "SourceChunk" ("id", "accountId", "sourceId", "chunkIndex", "content", "embedding", "createdAt")
      VALUES (gen_random_uuid()::text, ${accountId}, ${sourceId}, ${i}, ${chunks[i]}, ${literal}::vector, CURRENT_TIMESTAMP)
    `;
  }

  return chunks.length;
}

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  distance: number;
}

/**
 * Cosine-nearest chunks for a question, scoped to one account. Returns [] if the
 * caller cannot access the account (no throw on read path — chat just answers
 * "no signals"). `<=>` is pgvector cosine distance (smaller = closer).
 */
export async function searchAccountChunks(
  context: SessionContext,
  accountId: string,
  question: string,
  k = 6,
  db: DbClient = prisma,
): Promise<RetrievedChunk[]> {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, accountId),
    select: { id: true },
  });
  if (!account) {
    return [];
  }

  const embedding = await embedQuery(question);
  const literal = toVectorLiteral(embedding);

  const rows = await db.$queryRaw<RetrievedChunk[]>`
    SELECT "id", "sourceId", "chunkIndex", "content",
           ("embedding" <=> ${literal}::vector) AS "distance"
    FROM "SourceChunk"
    WHERE "accountId" = ${account.id}
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${Prisma.raw(String(Math.max(1, Math.floor(k))))}
  `;

  return rows;
}
