import { z } from "zod";

import { PRODUCT_FEATURES } from "@/lib/catalog";

export const SourceTypeSchema = z.enum(["call", "email", "usage"]);
export const ConfidenceSchema = z.number().min(0).max(1);

export const EvidenceSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: SourceTypeSchema,
  quote: z.string().min(1),
});

export const GoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
  confidence: ConfidenceSchema,
});

export const GoalsSchema = z.object({
  goals: z.array(GoalSchema),
});

export const UsageMetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  context: z.string().optional(),
});

export const UsageItemSchema = z.object({
  goalId: z.string().min(1),
  status: z.enum(["working", "partial", "lagging"]),
  metrics: z.array(UsageMetricSchema),
  notes: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
  confidence: ConfidenceSchema,
});

export const UsageSchema = z.object({
  usage: z.array(UsageItemSchema),
});

export const GapSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  feature: z.enum(PRODUCT_FEATURES),
  reason: z.string().min(1),
  severity: z.number().int().min(1).max(5),
  evidence: z.array(EvidenceSchema).min(1),
  confidence: ConfidenceSchema,
});

export const GapsSchema = z.object({
  gaps: z.array(GapSchema),
});

export const OpportunitySchema = z.object({
  id: z.string().min(1),
  gapId: z.string().min(1),
  feature: z.enum(PRODUCT_FEATURES),
  // Optional so historical runs persisted before titles existed still parse.
  // The pipeline prompt asks the model to always produce one for new runs.
  title: z.string().min(1).max(80).optional(),
  pitch: z.string().min(1),
  expectedImpact: z.string().min(1),
  score: z.number().min(0).max(1),
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceSchema).min(1),
});

export const OpportunitiesSchema = z.object({
  opportunities: z.array(OpportunitySchema),
});

export const QbrOutlineSchema = z.object({
  goals: z.array(z.string().min(1)),
  currentPerformance: z.array(z.string().min(1)),
  gaps: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  asks: z.array(z.string().min(1)),
});

export const DeckSlideSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1).max(6),
});

export const BriefSchema = z.object({
  accountName: z.string().min(1),
  summary: z.string().min(1),
  topGaps: z.array(z.string().min(1)).max(3),
  topOpportunities: z.array(z.string().min(1)).max(3),
  qbrOutline: QbrOutlineSchema,
  deckSlides: z.array(DeckSlideSchema).min(3),
  overallConfidence: ConfidenceSchema,
});

export const NarrativeSchema = z.object({
  brief: BriefSchema,
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type GoalsResult = z.infer<typeof GoalsSchema>;
export type UsageItem = z.infer<typeof UsageItemSchema>;
export type UsageResult = z.infer<typeof UsageSchema>;
export type Gap = z.infer<typeof GapSchema>;
export type GapsResult = z.infer<typeof GapsSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type OpportunitiesResult = z.infer<typeof OpportunitiesSchema>;
export type Brief = z.infer<typeof BriefSchema>;
export type NarrativeResult = z.infer<typeof NarrativeSchema>;

export function validateOpportunityInvariants(
  opportunities: Opportunity[],
  gaps: Gap[],
) {
  const gapIds = new Set(gaps.map((gap) => gap.id));
  const invalid = opportunities.find((opportunity) => !gapIds.has(opportunity.gapId));
  if (invalid) {
    throw new Error(
      `Opportunity ${invalid.id} references unknown gapId ${invalid.gapId}.`,
    );
  }
}

/**
 * The narrative stage chooses which gaps/opportunities make the top-3, but the
 * choice should be driven by the severity/score the earlier stages computed —
 * not left entirely to the model. This re-ranks the brief's selections so the
 * highest-severity gaps and highest-scoring opportunities lead, while keeping
 * the model's selection as the tie-breaker (and never inventing new ids).
 */
export function rankBriefSelections(
  brief: Brief,
  gaps: Gap[],
  opportunities: Opportunity[],
): Brief {
  const gapSeverity = new Map(gaps.map((gap) => [gap.id, gap.severity]));
  const opportunityScore = new Map(
    opportunities.map((opportunity) => [opportunity.id, opportunity.score]),
  );

  const rankBy = <V>(ids: string[], weights: Map<string, V>, fallback: V) =>
    ids
      .map((id, index) => ({ id, index }))
      .sort((a, b) => {
        const weightA = (weights.get(a.id) ?? fallback) as number;
        const weightB = (weights.get(b.id) ?? fallback) as number;
        if (weightB !== weightA) {
          return weightB - weightA;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.id);

  return {
    ...brief,
    topGaps: rankBy(brief.topGaps, gapSeverity, 0),
    topOpportunities: rankBy(brief.topOpportunities, opportunityScore, 0),
  };
}

export function validateNarrativeInvariants(
  brief: Brief,
  gaps: Gap[],
  opportunities: Opportunity[],
) {
  const gapIds = new Set(gaps.map((gap) => gap.id));
  const opportunityIds = new Set(opportunities.map((opportunity) => opportunity.id));

  const invalidGap = brief.topGaps.find((gapId) => !gapIds.has(gapId));
  if (invalidGap) {
    throw new Error(`Brief references unknown top gap ${invalidGap}.`);
  }

  const invalidOpportunity = brief.topOpportunities.find(
    (opportunityId) => !opportunityIds.has(opportunityId),
  );
  if (invalidOpportunity) {
    throw new Error(
      `Brief references unknown top opportunity ${invalidOpportunity}.`,
    );
  }
}
