import { beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeAccountInput } from "@/lib/ingest";
import { runPipeline } from "@/lib/pipeline";

describe("pipeline glue", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.EXTRACTION_MODEL;
    delete process.env.NARRATIVE_MODEL;
  });

  it("runs the five stages and retries on invariant failure", async () => {
    const mockGenerateObject = vi
      .fn()
      .mockResolvedValueOnce({
        object: {
          goals: [
            {
              id: "goal-1",
              title: "Reduce missed calls",
              description: "Customer wants after-hours coverage.",
              evidence: [
                {
                  sourceId: "call-1",
                  sourceType: "call",
                  quote: "We miss calls after hours.",
                },
              ],
              confidence: 0.9,
            },
          ],
        },
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      })
      .mockResolvedValueOnce({
        object: {
          usage: [
            {
              goalId: "goal-1",
              status: "lagging",
              metrics: [{ label: "Missed calls L30", value: "12" }],
              notes: "Missed-call volume is still material.",
              evidence: [
                {
                  sourceId: "usage-1",
                  sourceType: "usage",
                  quote: "MISSED CALLS L30: 12.0",
                },
              ],
              confidence: 0.83,
            },
          ],
        },
        usage: { inputTokens: 110, outputTokens: 25, totalTokens: 135 },
      })
      .mockResolvedValueOnce({
        object: {
          gaps: [
            {
              id: "gap-1",
              goalId: "goal-1",
              feature: "AI",
              reason: "AI is not covering enough inbound demand after hours.",
              severity: 4,
              evidence: [
                {
                  sourceId: "call-1",
                  sourceType: "call",
                  quote: "We miss calls after hours.",
                },
              ],
              confidence: 0.81,
            },
          ],
        },
        usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
      })
      .mockResolvedValueOnce({
        object: {
          opportunities: [
            {
              id: "opp-bad",
              gapId: "missing-gap",
              feature: "AI",
              title: "Expansion opportunity",
              pitch: "Pitch AI",
              expectedImpact: "Coverage",
              score: 0.9,
              confidence: 0.8,
              evidence: [
                {
                  sourceId: "call-1",
                  sourceType: "call",
                  quote: "We miss calls after hours.",
                },
              ],
            },
          ],
        },
        usage: { inputTokens: 130, outputTokens: 25, totalTokens: 155 },
      })
      .mockResolvedValueOnce({
        object: {
          opportunities: [
            {
              id: "opp-1",
              gapId: "gap-1",
              feature: "AI",
              title: "Expansion opportunity",
              pitch: "Expand AI coverage for after-hours inquiries.",
              expectedImpact: "Recover more inbound leads without adding headcount.",
              score: 0.92,
              confidence: 0.84,
              evidence: [
                {
                  sourceId: "gap-1",
                  sourceType: "call",
                  quote: "We miss calls after hours.",
                },
              ],
            },
          ],
        },
        usage: { inputTokens: 132, outputTokens: 28, totalTokens: 160 },
      })
      .mockResolvedValueOnce({
        object: {
          brief: {
            accountName: "Northfield Electrical",
            summary: "After-hours demand is still leaking, with AI as the clearest expansion path.",
            topGaps: ["gap-1"],
            topOpportunities: ["opp-1"],
            qbrOutline: {
              goals: ["Reduce missed calls"],
              currentPerformance: ["Missed calls remain elevated."],
              gaps: ["AI coverage is underused after hours."],
              opportunities: ["Expand AI coverage for inbound qualification."],
              asks: ["Approve AI expansion plan."],
            },
            deckSlides: [
              { title: "Executive summary", bullets: ["After-hours demand is leaking."] },
              { title: "Gap", bullets: ["AI coverage is underused."] },
              { title: "Ask", bullets: ["Approve expansion."] },
            ],
            overallConfidence: 0.82,
          },
        },
        usage: { inputTokens: 140, outputTokens: 40, totalTokens: 180 },
      });

    const input = normalizeAccountInput({
      accountName: "Northfield Electrical",
      transcripts: [
        {
          id: "call-1",
          type: "call",
          label: "phones-ai-review",
          content: "Customer: We miss calls after hours and want faster responses.",
        },
      ],
      usageRow: {
        "ORGANIZATION NAME": "Mr Sparky",
        "MISSED CALLS L30": "12.0",
        "Location AI Subscriptio Status": "active subscription",
        "AI PRODUCT NAMES": "[\"Text AI\"]",
      },
    });

    const result = await runPipeline(input, {
      generateObject: mockGenerateObject,
    });

    expect(mockGenerateObject).toHaveBeenCalledTimes(6);
    expect(result.brief.topOpportunities).toEqual(["opp-1"]);
    expect(result.usageTotals.totalTokens).toBe(120 + 135 + 150 + 160 + 180);
    expect(result.stages[3]?.attempts).toBe(2);
  });
});
