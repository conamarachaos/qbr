import { type TokenTotals } from "@/lib/pipeline/shared";

export interface ModelPricingEstimate {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
}

// Estimated public Anthropic API rates as of 2026-05 for base input/output tokens.
export const CLAUDE_SONNET_4_6_ESTIMATE: ModelPricingEstimate = {
  inputUsdPerMTok: 3,
  outputUsdPerMTok: 15,
};

// Estimated public Anthropic API rates as of 2026-05 for base input/output tokens.
export const CLAUDE_OPUS_4_8_ESTIMATE: ModelPricingEstimate = {
  inputUsdPerMTok: 15,
  outputUsdPerMTok: 75,
};

const MODEL_PRICING_ESTIMATES: Record<string, ModelPricingEstimate> = {
  "claude-sonnet-4-6": CLAUDE_SONNET_4_6_ESTIMATE,
  "claude-opus-4-8": CLAUDE_OPUS_4_8_ESTIMATE,
};

function normalizeModelId(modelId: string) {
  const normalized = modelId.toLowerCase();

  if (normalized.includes("claude-sonnet-4-6") || normalized.includes("claude-sonnet-4")) {
    return "claude-sonnet-4-6";
  }

  if (normalized.includes("claude-opus-4-8") || normalized.includes("claude-opus-4")) {
    return "claude-opus-4-8";
  }

  return normalized;
}

export function getModelPricingEstimate(modelId: string) {
  return MODEL_PRICING_ESTIMATES[normalizeModelId(modelId)];
}

export function estimateUsageCostUsd(modelId: string, usage: TokenTotals) {
  const pricing = getModelPricingEstimate(modelId);
  if (!pricing) {
    return 0;
  }

  return (
    (usage.inputTokens / 1_000_000) * pricing.inputUsdPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputUsdPerMTok
  );
}

export function estimateStageCostsUsd(
  stages: Array<{
    id: string;
    label: string;
    modelId: string;
    usage: TokenTotals;
  }>,
) {
  const breakdown = stages.map((stage) => ({
    ...stage,
    estimatedUsd: estimateUsageCostUsd(stage.modelId, stage.usage),
  }));

  return {
    breakdown,
    totalUsd: breakdown.reduce((sum, stage) => sum + stage.estimatedUsd, 0),
  };
}

export function formatEstimatedUsd(usd: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: usd < 0.01 ? 4 : 2,
    maximumFractionDigits: usd < 0.01 ? 4 : 2,
  }).format(usd);
}
