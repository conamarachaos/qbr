import { describe, expect, it, vi } from "vitest";

import { chunkText } from "@/lib/repo/chunks";

// We test answerAccountQuestion's grounding behaviour with an injected fake
// generateObject and a fake Prisma client, so no DB or model is needed. The
// account access + chunk search go through the real db.account / $queryRaw paths,
// which we stub on the fake client.

import { answerAccountQuestion } from "@/lib/repo/chat";

const context = { userId: "u1", workspaceId: "w1", role: "admin" as const };

function makeFakeDb(chunks: Array<{ sourceId: string; chunkIndex: number; content: string; distance: number }>) {
  const created: Array<{ role: string; content: string; citations?: unknown }> = [];
  return {
    created,
    db: {
      account: {
        findFirst: vi.fn().mockResolvedValue({ id: "acc1" }),
      },
      qbrRun: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      chatMessage: {
        create: vi.fn(async ({ data }: { data: { role: string; content: string; citations?: unknown } }) => {
          created.push({ role: data.role, content: data.content, citations: data.citations });
          return data;
        }),
      },
      // searchAccountChunks calls db.account.findFirst then db.$queryRaw.
      $queryRaw: vi.fn().mockResolvedValue(chunks),
    } as never,
  };
}

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
  });

  it("splits long text into overlapping chunks", () => {
    const text = "para one.\n\n" + "x".repeat(2000);
    const chunks = chunkText(text, { size: 500, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("returns nothing for empty text", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});

describe("answerAccountQuestion grounding", () => {
  const sourceContent = "Customer: We want to increase Google reviews and respond faster to leads.";

  it("marks a verbatim quote as grounded", async () => {
    const { db, created } = makeFakeDb([
      { sourceId: "call-1", chunkIndex: 0, content: sourceContent, distance: 0.1 },
    ]);

    const generateObjectImpl = vi.fn().mockResolvedValue({
      object: {
        answer: "They want more Google reviews.",
        citations: [{ sourceId: "call-1", quote: "increase Google reviews" }],
      },
    });

    const result = await answerAccountQuestion(
      context,
      { accountId: "acc1", question: "What are their goals?" },
      { generateObjectImpl },
      db,
    );

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].grounded).toBe(true);
    // Persisted both the user turn and the assistant turn.
    expect(created.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("flags a fabricated quote as ungrounded", async () => {
    const { db } = makeFakeDb([
      { sourceId: "call-1", chunkIndex: 0, content: sourceContent, distance: 0.1 },
    ]);

    const generateObjectImpl = vi.fn().mockResolvedValue({
      object: {
        answer: "They are losing six figures.",
        citations: [{ sourceId: "call-1", quote: "we are losing six figures every quarter" }],
      },
    });

    const result = await answerAccountQuestion(
      context,
      { accountId: "acc1", question: "Are they at risk?" },
      { generateObjectImpl },
      db,
    );

    expect(result.citations[0].grounded).toBe(false);
  });

  it("flags a quote citing an unknown source as ungrounded", async () => {
    const { db } = makeFakeDb([
      { sourceId: "call-1", chunkIndex: 0, content: sourceContent, distance: 0.1 },
    ]);

    const generateObjectImpl = vi.fn().mockResolvedValue({
      object: {
        answer: "Per another call…",
        citations: [{ sourceId: "call-999", quote: "increase Google reviews" }],
      },
    });

    const result = await answerAccountQuestion(
      context,
      { accountId: "acc1", question: "What did they say?" },
      { generateObjectImpl },
      db,
    );

    expect(result.citations[0].grounded).toBe(false);
  });

  it("returns a no-context answer when nothing is indexed and never calls the model", async () => {
    const { db } = makeFakeDb([]);
    const generateObjectImpl = vi.fn();

    const result = await answerAccountQuestion(
      context,
      { accountId: "acc1", question: "Anything?" },
      { generateObjectImpl },
      db,
    );

    expect(result.noContext).toBe(true);
    expect(generateObjectImpl).not.toHaveBeenCalled();
  });
});
