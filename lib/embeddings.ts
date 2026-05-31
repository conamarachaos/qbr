/**
 * Embeddings provider for the grounded account Q&A chatbot.
 *
 * Uses OpenAI `text-embedding-3-small` (1536-dim) via REST. Requests are batched
 * (the API accepts an array of inputs) and retried with exponential backoff on
 * rate-limit (429) / transient (5xx) errors, so bulk indexing stays within tier
 * limits without one-request-per-chunk fan-out.
 *
 * If `OPENAI_API_KEY` is unset we fall back to a deterministic local hash-embedding
 * of the same dimension so dev/demo/tests run offline. Recall is weaker, but nothing
 * hard-breaks — labelled via `isUsingFallbackEmbeddings()`.
 */

/** pgvector column is `vector(1536)`; this is the single source of truth for the dim. */
export const EMBEDDING_DIM = 1536;

const OPENAI_URL = "https://api.openai.com/v1/embeddings";

/** Max inputs per request. OpenAI allows up to 2048; keep modest for payload size. */
const MAX_BATCH = 96;
const MAX_RETRIES = 5;

function getModel() {
  return process.env.EMBEDDING_MODEL || "text-embedding-3-small";
}

export function isUsingFallbackEmbeddings() {
  return !process.env.OPENAI_API_KEY;
}

interface OpenAiResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postBatch(texts: string[], apiKey: string): Promise<number[][]> {
  let attempt = 0;

  for (;;) {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: getModel(),
        dimensions: EMBEDDING_DIM,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as OpenAiResponse;
      return payload.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    }

    // Retry on rate-limit / transient server errors with exponential backoff.
    const retriable = response.status === 429 || response.status >= 500;
    if (retriable && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(2 ** attempt * 1000, 30_000);
      attempt += 1;
      await sleep(backoff);
      continue;
    }

    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${detail}`);
  }
}

async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return texts.map((text) => fallbackEmbedding(text));
  }

  const results: number[][] = [];
  for (let start = 0; start < texts.length; start += MAX_BATCH) {
    const batch = texts.slice(start, start + MAX_BATCH);
    results.push(...(await postBatch(batch, apiKey)));
  }
  return results;
}

/** Embed a batch of document chunks for indexing. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  return embed(texts);
}

/** Embed a single search query. */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embed([text]);
  return embedding;
}

/**
 * Deterministic local embedding used only when no API key is configured.
 * Hashes tokens into a fixed-dim bag-of-words vector and L2-normalizes it, so the
 * same text always maps to the same vector and cosine similarity still reflects
 * lexical overlap. Not semantically strong — purely a demo/offline safety net.
 */
export function fallbackEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % EMBEDDING_DIM;
    vector[index] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

/** Serialize a vector to the pgvector text literal form: `[0.1,0.2,...]`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
