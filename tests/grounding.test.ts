import { describe, expect, it } from "vitest";

import { isQuoteGrounded, verifyItems } from "@/lib/grounding";
import type { NormalizedSource } from "@/lib/ingest";

const sourceMap: Record<string, NormalizedSource> = {
  "call-1": {
    id: "call-1",
    type: "call",
    label: "onboarding",
    content: "Customer: We miss calls after hours\nand want faster responses.",
  },
};

describe("isQuoteGrounded", () => {
  it("matches verbatim quotes", () => {
    expect(isQuoteGrounded("We miss calls after hours", sourceMap["call-1"].content)).toBe(true);
  });

  it("matches across whitespace and casing differences", () => {
    expect(
      isQuoteGrounded("we miss calls after hours and want faster", sourceMap["call-1"].content),
    ).toBe(true);
  });

  it("rejects fabricated quotes", () => {
    expect(
      isQuoteGrounded("We are losing six figures every quarter", sourceMap["call-1"].content),
    ).toBe(false);
  });

  it("rejects empty quotes", () => {
    expect(isQuoteGrounded("   ", sourceMap["call-1"].content)).toBe(false);
  });
});

describe("verifyItems", () => {
  it("separates grounded items from items with issues", () => {
    const { grounded, issues } = verifyItems(
      "Goal",
      [
        {
          id: "goal-1",
          evidence: [{ sourceId: "call-1", sourceType: "call", quote: "We miss calls after hours" }],
        },
        {
          id: "goal-2",
          evidence: [{ sourceId: "call-1", sourceType: "call", quote: "We need a CRM rebuild" }],
        },
        {
          id: "goal-3",
          evidence: [{ sourceId: "ghost-9", sourceType: "call", quote: "anything" }],
        },
      ],
      sourceMap,
    );

    expect(grounded.map((item) => item.id)).toEqual(["goal-1"]);
    expect(issues).toHaveLength(2);
    expect(issues.find((issue) => issue.itemId === "goal-2")?.reason).toBe("quote-not-found");
    expect(issues.find((issue) => issue.itemId === "goal-3")?.reason).toBe("unknown-source");
  });
});
