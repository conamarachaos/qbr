import { generateObject } from "ai";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { isQuoteGrounded } from "@/lib/grounding";
import { getNarrativeModel } from "@/lib/models";
import { parsePersistedBriefData } from "@/lib/repo/runs";
import { buildAccountAccessWhere, buildVisibleAccountsWhere } from "@/lib/repo/access";
import { searchAccountChunks, type RetrievedChunk } from "@/lib/repo/chunks";
import { type DbClient, type SessionContext } from "@/lib/repo/types";

/**
 * Grounded account Q&A. Answers ONLY from the account's own retrieved source
 * chunks + the latest persisted brief, and every citation is re-verified against
 * the cited source via `isQuoteGrounded` — the same trust discipline the QBR
 * brief uses. Ungrounded citations are flagged (not silently dropped) so the UI
 * can surface them, directly addressing the case study's "low trust in AI
 * outputs" risk.
 */

export interface ChatCitation {
  sourceId: string;
  quote: string;
  grounded: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AnswerResult {
  answer: string;
  citations: ChatCitation[];
  /** True when there was no account context to answer from. */
  noContext: boolean;
}

const AnswerSchema = z.object({
  answer: z
    .string()
    .describe(
      "Answer to the question using ONLY the provided sources. If the sources do not " +
        "contain the answer, say so plainly.",
    ),
  citations: z
    .array(
      z.object({
        sourceId: z.string().describe("The [sourceId] of the chunk the quote is taken from."),
        quote: z
          .string()
          .describe("An exact, verbatim quote copied from that source supporting the answer."),
      }),
    )
    .describe("Every factual claim in the answer must be backed by a verbatim source quote."),
});

const HISTORY_LIMIT = 8;
const MAX_QUESTION_LENGTH = 2000;

function buildContextBlock(chunks: RetrievedChunk[]): { block: string; byId: Map<string, string> } {
  // Concatenate all chunk content per source so quote verification can match a
  // quote against the full retrieved text for that source.
  const byId = new Map<string, string>();
  const lines: string[] = [];

  for (const chunk of chunks) {
    const existing = byId.get(chunk.sourceId);
    byId.set(chunk.sourceId, existing ? `${existing}\n${chunk.content}` : chunk.content);
    lines.push(`[${chunk.sourceId}] ${chunk.content}`);
  }

  return { block: lines.join("\n\n"), byId };
}

function formatHistory(history: ChatTurn[]): string {
  if (history.length === 0) {
    return "";
  }
  return history
    .slice(-HISTORY_LIMIT)
    .map((turn) => `${turn.role === "user" ? "AM" : "Assistant"}: ${turn.content}`)
    .join("\n");
}

/**
 * Load the latest persisted brief summary for an account as extra structured
 * context (it is already cited + confidence-scored). Returns "" if none.
 */
async function loadBriefContext(
  context: SessionContext,
  accountId: string,
  db: DbClient,
): Promise<string> {
  const run = await db.qbrRun.findFirst({
    where: {
      accountId,
      status: "ready",
      account: buildAccountAccessWhere(context, accountId),
    },
    orderBy: { createdAt: "desc" },
    include: { brief: true },
  });

  if (!run?.brief) {
    return "";
  }

  try {
    const data = parsePersistedBriefData(run.brief.data);
    return [
      `QBR SUMMARY: ${data.brief.summary}`,
      `Top gaps: ${data.brief.topGaps.join("; ")}`,
      `Top opportunities: ${data.brief.topOpportunities.join("; ")}`,
    ].join("\n");
  } catch {
    return "";
  }
}

export async function answerAccountQuestion(
  context: SessionContext,
  input: {
    accountId: string;
    question: string;
    history?: ChatTurn[];
  },
  options: { generateObjectImpl?: typeof generateObject } = {},
  db: DbClient = prisma,
): Promise<AnswerResult> {
  const question = input.question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!question) {
    throw new Error("Question is required.");
  }

  const chunks = await searchAccountChunks(context, input.accountId, question, 6, db);
  const briefContext = await loadBriefContext(context, input.accountId, db);

  // Persist the user turn regardless of outcome.
  await db.chatMessage.create({
    data: {
      accountId: input.accountId,
      userId: context.userId,
      role: "user",
      content: question,
    },
  });

  if (chunks.length === 0 && !briefContext) {
    const answer =
      "I don't have any signals indexed for this account yet, so I can't answer from its data. " +
      "Add call/email/usage sources or run a QBR first.";
    await db.chatMessage.create({
      data: { accountId: input.accountId, userId: context.userId, role: "assistant", content: answer },
    });
    return { answer, citations: [], noContext: true };
  }

  const { block, byId } = buildContextBlock(chunks);
  const generate = options.generateObjectImpl ?? generateObject;

  const system =
    "You are an account assistant for a Customer Account Manager. Answer the question " +
    "using ONLY the SOURCES and QBR context provided. Do not use outside knowledge. " +
    "Every factual claim must be supported by a verbatim quote copied exactly from a " +
    "source, tagged with that source's [sourceId]. If the sources do not contain the " +
    "answer, say you don't have that information in this account's signals — do not guess.";

  const prompt = [
    briefContext ? `QBR CONTEXT:\n${briefContext}\n` : "",
    `SOURCES:\n${block || "(no source chunks retrieved)"}\n`,
    formatHistory(input.history ?? []) ? `CONVERSATION SO FAR:\n${formatHistory(input.history ?? [])}\n` : "",
    `QUESTION: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generate({
    model: getNarrativeModel(),
    schema: AnswerSchema,
    system,
    prompt,
  });

  // Verify every citation against the source it claims to quote — same verifier
  // the QBR brief uses. Flag (don't drop) so the UI can show trust state.
  const citations: ChatCitation[] = result.object.citations.map((citation) => {
    const sourceContent = byId.get(citation.sourceId);
    const grounded = sourceContent ? isQuoteGrounded(citation.quote, sourceContent) : false;
    return { sourceId: citation.sourceId, quote: citation.quote, grounded };
  });

  await db.chatMessage.create({
    data: {
      accountId: input.accountId,
      userId: context.userId,
      role: "assistant",
      content: result.object.answer,
      citations: citations as unknown as object,
    },
  });

  return { answer: result.object.answer, citations, noContext: false };
}

/**
 * Resolve a free-text account name to an account the user can actually see.
 * Used by the global chat widget. Matching, in order: exact (case-insensitive),
 * then unique substring match. Returns null if nothing matches; returns the list
 * of candidates when a substring is ambiguous so the caller can ask to clarify.
 */
export async function resolveAccountByName(
  context: SessionContext,
  name: string,
  db: DbClient = prisma,
): Promise<
  | { status: "ok"; accountId: string; accountName: string }
  | { status: "ambiguous"; candidates: Array<{ id: string; name: string }> }
  | { status: "not_found" }
> {
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return { status: "not_found" };
  }

  const accounts = await db.account.findMany({
    where: buildVisibleAccountsWhere(context),
    select: { id: true, name: true },
  });

  const exact = accounts.filter((account) => account.name.toLowerCase() === needle);
  if (exact.length === 1) {
    return { status: "ok", accountId: exact[0].id, accountName: exact[0].name };
  }

  const partial = accounts.filter((account) => account.name.toLowerCase().includes(needle));
  if (partial.length === 1) {
    return { status: "ok", accountId: partial[0].id, accountName: partial[0].name };
  }
  if (partial.length > 1) {
    return { status: "ambiguous", candidates: partial.map((a) => ({ id: a.id, name: a.name })) };
  }

  return { status: "not_found" };
}

/** Load prior chat history for an account (oldest first), scoped to the session. */
export async function getChatHistory(
  context: SessionContext,
  accountId: string,
  limit = 50,
  db: DbClient = prisma,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, accountId),
    select: { id: true },
  });
  if (!account) {
    return [];
  }

  const messages = await db.chatMessage.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    citations: (message.citations as ChatCitation[] | null) ?? [],
    createdAt: message.createdAt,
  }));
}
