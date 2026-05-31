import { describe, expect, it } from "vitest";

import { rankBriefSelections, type Brief, type Gap, type Opportunity } from "@/lib/schemas";

const evidence = [{ sourceId: "call-1", sourceType: "call" as const, quote: "q" }];

const gaps: Gap[] = [
  { id: "gap-low", goalId: "g1", feature: "Reviews", reason: "r", severity: 2, evidence, confidence: 0.7 },
  { id: "gap-high", goalId: "g1", feature: "AI", reason: "r", severity: 5, evidence, confidence: 0.8 },
  { id: "gap-mid", goalId: "g1", feature: "Webchat", reason: "r", severity: 3, evidence, confidence: 0.7 },
];

const opportunities: Opportunity[] = [
  { id: "opp-mid", gapId: "gap-mid", feature: "Webchat", title: "Mid opp", pitch: "p", expectedImpact: "i", score: 0.5, confidence: 0.7, evidence },
  { id: "opp-high", gapId: "gap-high", feature: "AI", title: "High opp", pitch: "p", expectedImpact: "i", score: 0.95, confidence: 0.8, evidence },
];

const brief: Brief = {
  accountName: "Acme",
  summary: "s",
  topGaps: ["gap-low", "gap-high", "gap-mid"],
  topOpportunities: ["opp-mid", "opp-high"],
  qbrOutline: { goals: ["g"], currentPerformance: ["p"], gaps: ["x"], opportunities: ["o"], asks: ["a"] },
  deckSlides: [
    { title: "t1", bullets: ["b"] },
    { title: "t2", bullets: ["b"] },
    { title: "t3", bullets: ["b"] },
  ],
  overallConfidence: 0.8,
};

describe("rankBriefSelections", () => {
  it("orders top gaps by severity and opportunities by score", () => {
    const ranked = rankBriefSelections(brief, gaps, opportunities);
    expect(ranked.topGaps).toEqual(["gap-high", "gap-mid", "gap-low"]);
    expect(ranked.topOpportunities).toEqual(["opp-high", "opp-mid"]);
  });

  it("does not introduce or drop ids", () => {
    const ranked = rankBriefSelections(brief, gaps, opportunities);
    expect([...ranked.topGaps].sort()).toEqual([...brief.topGaps].sort());
  });
});
