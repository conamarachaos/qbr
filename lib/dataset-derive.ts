import { type HealthCategory, type Tier } from "@prisma/client";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function deriveTier(arrUsd?: number | null): Tier {
  if (!arrUsd) {
    return "growth";
  }
  if (arrUsd >= 120000) {
    return "strategic";
  }
  if (arrUsd < 40000) {
    return "at_risk";
  }
  return "growth";
}

// The Podium extract has no renewal/contract-end column, so we synthesize a
// plausible renewal date spread across imported accounts (today + 30d, +60d, …).
export function deriveRenewalDate(index: number, from = new Date()) {
  const renewal = new Date(from);
  renewal.setUTCDate(renewal.getUTCDate() + 30 + index * 30);
  return renewal;
}

export function deriveHealth(input: {
  transcriptCount: number;
  usageProducts: number;
  reviewInvites?: number | null;
  missedCalls?: number | null;
}) {
  const reviewScore = clamp((input.reviewInvites ?? 0) / 8, 0, 25);
  const adoptionScore = clamp(input.usageProducts * 8, 0, 30);
  const engagementScore = clamp(input.transcriptCount * 6, 10, 25);
  const phonePenalty = clamp((input.missedCalls ?? 0) / 2, 0, 20);

  const overall = clamp(
    Math.round(reviewScore + adoptionScore + engagementScore + (20 - phonePenalty)),
    25,
    95,
  );

  const category: HealthCategory =
    overall >= 70 ? "healthy" : overall >= 45 ? "at_risk" : "critical";

  return {
    overall,
    category,
    components: {
      usage: Math.round(adoptionScore * 3),
      support: Math.round((20 - phonePenalty) * 5),
      sentiment: Math.round(reviewScore * 4),
      engagement: Math.round(engagementScore * 4),
    },
  };
}

export function currentQuarter(date = new Date()) {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${quarter}`;
}
