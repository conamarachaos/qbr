import { describe, expect, it } from "vitest";

import {
  estimateStageCostsUsd,
  estimateUsageCostUsd,
  getModelPricingEstimate,
} from "@/lib/pricing";

describe("pricing estimates", () => {
  it("prices usage from model-specific MTok rates", () => {
    const estimatedUsd = estimateUsageCostUsd("claude-sonnet-4-6", {
      inputTokens: 1_000_000,
      outputTokens: 2_000_000,
      totalTokens: 3_000_000,
    });

    expect(estimatedUsd).toBe(33);
    expect(getModelPricingEstimate("claude-opus-4-8-20260501")).toEqual({
      inputUsdPerMTok: 15,
      outputUsdPerMTok: 75,
    });
  });

  it("sums stage-level estimates", () => {
    const costs = estimateStageCostsUsd([
      {
        id: "stage1",
        label: "Goal extraction",
        modelId: "claude-sonnet-4-6",
        usage: { inputTokens: 500_000, outputTokens: 100_000, totalTokens: 600_000 },
      },
      {
        id: "stage2",
        label: "Narrative generation",
        modelId: "claude-opus-4-8",
        usage: { inputTokens: 100_000, outputTokens: 50_000, totalTokens: 150_000 },
      },
    ]);

    expect(costs.breakdown).toHaveLength(2);
    expect(costs.totalUsd).toBeCloseTo(8.25, 6);
  });
});
