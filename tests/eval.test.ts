import { describe, expect, it } from "vitest";

import { evaluatePipelineStructure } from "@/lib/eval";

describe("eval harness invariants", () => {
  it("passes a deterministic offline fixture result", () => {
    const evaluation = evaluatePipelineStructure({
      goals: {
        goals: [
          {
            id: "goal-1",
            title: "Improve response speed",
            description: "The team wants faster first response coverage.",
            evidence: [
              {
                sourceId: "call-1",
                sourceType: "call",
                quote: "We need to respond faster after hours.",
              },
            ],
            confidence: 0.9,
          },
          {
            id: "goal-2",
            title: "Tighten quote follow-up",
            description: "More visible follow-up is needed after customer inquiries.",
            evidence: [
              {
                sourceId: "call-2",
                sourceType: "call",
                quote: "Quote follow-up is still manual.",
              },
            ],
            confidence: 0.82,
          },
          {
            id: "goal-3",
            title: "Connect communication to collection",
            description: "The account wants a shorter path from conversation to cash.",
            evidence: [
              {
                sourceId: "usage-1",
                sourceType: "usage",
                quote: "PROCESSED AMOUNT LAST 30 DAYS: 0",
              },
            ],
            confidence: 0.8,
          },
        ],
      },
      gaps: {
        gaps: [
          {
            id: "gap-1",
            goalId: "goal-1",
            feature: "AI",
            reason: "AI coverage is still under-tuned after hours.",
            severity: 5,
            evidence: [
              {
                sourceId: "call-1",
                sourceType: "call",
                quote: "We need to respond faster after hours.",
              },
            ],
            confidence: 0.86,
          },
          {
            id: "gap-2",
            goalId: "goal-2",
            feature: "Messaging",
            reason: "Follow-up ownership is not visible enough across the team.",
            severity: 4,
            evidence: [
              {
                sourceId: "call-2",
                sourceType: "call",
                quote: "Quote follow-up is still manual.",
              },
            ],
            confidence: 0.81,
          },
          {
            id: "gap-3",
            goalId: "goal-3",
            feature: "Payments",
            reason: "Payment collection is detached from the active conversation flow.",
            severity: 4,
            evidence: [
              {
                sourceId: "usage-1",
                sourceType: "usage",
                quote: "PROCESSED AMOUNT LAST 30 DAYS: 0",
              },
            ],
            confidence: 0.78,
          },
        ],
      },
      opportunities: {
        opportunities: [
          {
            id: "opp-1",
            gapId: "gap-1",
            feature: "AI",
            title: "Expansion opportunity",
            pitch: "Expand AI coverage for faster after-hours triage.",
            expectedImpact: "Recover more high-intent conversations overnight.",
            score: 0.93,
            confidence: 0.84,
            evidence: [
              {
                sourceId: "call-1",
                sourceType: "call",
                quote: "We need to respond faster after hours.",
              },
            ],
          },
          {
            id: "opp-2",
            gapId: "gap-2",
            feature: "Messaging",
            title: "Expansion opportunity",
            pitch: "Centralize quote follow-up inside Podium Messaging.",
            expectedImpact: "Keep ownership and next steps visible.",
            score: 0.87,
            confidence: 0.8,
            evidence: [
              {
                sourceId: "call-2",
                sourceType: "call",
                quote: "Quote follow-up is still manual.",
              },
            ],
          },
          {
            id: "opp-3",
            gapId: "gap-3",
            feature: "Payments",
            title: "Expansion opportunity",
            pitch: "Embed payment requests into the customer conversation flow.",
            expectedImpact: "Shorten the path from approval to cash collection.",
            score: 0.83,
            confidence: 0.77,
            evidence: [
              {
                sourceId: "usage-1",
                sourceType: "usage",
                quote: "PROCESSED AMOUNT LAST 30 DAYS: 0",
              },
            ],
          },
        ],
      },
      brief: {
        accountName: "Northfield Electrical",
        summary: "Three grounded expansion paths exist across AI, Messaging, and Payments.",
        topGaps: ["gap-1", "gap-2", "gap-3"],
        topOpportunities: ["opp-1", "opp-2", "opp-3"],
        qbrOutline: {
          goals: [
            "Improve response speed",
            "Tighten quote follow-up",
            "Connect communication to collection",
          ],
          currentPerformance: [
            "After-hours response still leaks.",
            "Quote follow-up remains manual.",
            "Payment collection is disconnected.",
          ],
          gaps: [
            "AI coverage is still under-tuned after hours.",
            "Follow-up ownership is not visible enough.",
            "Payment collection is detached from the conversation flow.",
          ],
          opportunities: [
            "Expand AI coverage for faster after-hours triage.",
            "Centralize quote follow-up inside Podium Messaging.",
            "Embed payment requests into the customer conversation flow.",
          ],
          asks: [
            "Approve AI tuning rollout.",
            "Review Messaging workflow changes.",
            "Confirm Payments pilot scope.",
          ],
        },
        deckSlides: [
          { title: "Executive summary", bullets: ["Grounded expansion motion exists."] },
          { title: "Key gaps", bullets: ["AI, Messaging, and Payments gaps are active."] },
          { title: "Next asks", bullets: ["Approve rollout priorities."] },
        ],
        overallConfidence: 0.81,
      },
    });

    expect(evaluation.passed).toBe(true);
    expect(evaluation.errors).toEqual([]);
  });
});
