import { describe, expect, it } from "vitest";

import {
  GoalSchema,
  OpportunitiesSchema,
  validateNarrativeInvariants,
  validateOpportunityInvariants,
} from "@/lib/schemas";

describe("schemas and invariants", () => {
  it("requires evidence on grounded goals", () => {
    expect(() =>
      GoalSchema.parse({
        id: "goal-1",
        title: "Improve response time",
        description: "Customer wants to answer faster.",
        evidence: [],
        confidence: 0.8,
      }),
    ).toThrow();
  });

  it("enforces the catalog allowlist for opportunities", () => {
    expect(() =>
      OpportunitiesSchema.parse({
        opportunities: [
          {
            id: "opp-1",
            gapId: "gap-1",
            feature: "Analytics",
            title: "Expansion opportunity",
            pitch: "Sell analytics",
            expectedImpact: "New reporting",
            score: 0.7,
            confidence: 0.7,
            evidence: [
              {
                sourceId: "call-1",
                sourceType: "call",
                quote: "We need better visibility.",
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("guards the gap to opportunity invariant", () => {
    expect(() =>
      validateOpportunityInvariants(
        [
          {
            id: "opp-1",
            gapId: "gap-404",
            feature: "AI",
            title: "Expansion opportunity",
            pitch: "Pitch AI",
            expectedImpact: "Faster coverage",
            score: 0.8,
            confidence: 0.8,
            evidence: [
              {
                sourceId: "call-1",
                sourceType: "call",
                quote: "We are missing calls after-hours.",
              },
            ],
          },
        ],
        [],
      ),
    ).toThrow(/unknown gapId/);
  });

  it("guards brief references against missing ids", () => {
    expect(() =>
      validateNarrativeInvariants(
        {
          accountName: "Northfield Electrical",
          summary: "Summary",
          topGaps: ["gap-missing"],
          topOpportunities: [],
          qbrOutline: {
            goals: [],
            currentPerformance: [],
            gaps: [],
            opportunities: [],
            asks: [],
          },
          deckSlides: [
            { title: "One", bullets: ["A"] },
            { title: "Two", bullets: ["B"] },
            { title: "Three", bullets: ["C"] },
          ],
          overallConfidence: 0.6,
        },
        [],
        [],
      ),
    ).toThrow(/unknown top gap/);
  });
});
