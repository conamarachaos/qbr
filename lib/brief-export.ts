import { z } from "zod";

import {
  Brief,
  BriefSchema,
  Gap,
  GapSchema,
  Goal,
  GoalSchema,
  Opportunity,
  OpportunitySchema,
  QbrOutlineSchema,
  UsageItem,
  UsageItemSchema,
} from "@/lib/schemas";

export const EditableClaimSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const EditableBriefSchema = z.object({
  summary: z.string().min(1),
  topGaps: z.array(EditableClaimSchema).max(3),
  topOpportunities: z.array(EditableClaimSchema).max(3),
  qbrOutline: QbrOutlineSchema,
});

export const ExportPayloadSchema = z.object({
  brief: BriefSchema,
  goals: z.array(GoalSchema),
  usage: z.array(UsageItemSchema),
  gaps: z.array(GapSchema),
  opportunities: z.array(OpportunitySchema),
  editedBrief: EditableBriefSchema.optional(),
});

export type EditableClaim = z.infer<typeof EditableClaimSchema>;
export type EditableBrief = z.infer<typeof EditableBriefSchema>;
export type ExportPayload = z.infer<typeof ExportPayloadSchema>;

export function createEditableBrief(
  brief: Brief,
  gaps: Gap[],
  opportunities: Opportunity[],
): EditableBrief {
  return {
    summary: brief.summary,
    topGaps: brief.topGaps.map((gapId) => {
      const gap = gaps.find((item) => item.id === gapId);
      return {
        id: gapId,
        title: gap?.feature ?? gapId,
        description: gap?.reason ?? gapId,
      };
    }),
    topOpportunities: brief.topOpportunities.map((opportunityId) => {
      const opportunity = opportunities.find((item) => item.id === opportunityId);
      return {
        id: opportunityId,
        title: opportunity?.pitch ?? opportunityId,
        description: opportunity?.expectedImpact ?? opportunityId,
      };
    }),
    qbrOutline: {
      goals: [...brief.qbrOutline.goals],
      currentPerformance: [...brief.qbrOutline.currentPerformance],
      gaps: [...brief.qbrOutline.gaps],
      opportunities: [...brief.qbrOutline.opportunities],
      asks: [...brief.qbrOutline.asks],
    },
  };
}

export function applyEditedBrief(
  brief: Brief,
  editedBrief?: EditableBrief,
): Brief {
  if (!editedBrief) {
    return brief;
  }

  return {
    ...brief,
    summary: editedBrief.summary,
    qbrOutline: editedBrief.qbrOutline,
  };
}

export function resolveTopGapExports(
  brief: Brief,
  gaps: Gap[],
  editedBrief?: EditableBrief,
) {
  return brief.topGaps.map((gapId, index) => {
    const gap = gaps.find((item) => item.id === gapId);
    const editedGap = editedBrief?.topGaps.find((item) => item.id === gapId) ?? editedBrief?.topGaps[index];

    return {
      id: gapId,
      title: editedGap?.title ?? gap?.feature ?? gapId,
      description: editedGap?.description ?? gap?.reason ?? gapId,
      confidence: gap?.confidence ?? brief.overallConfidence,
      severity: gap?.severity,
      feature: gap?.feature,
      evidence: gap?.evidence ?? [],
    };
  });
}

export function resolveTopOpportunityExports(
  brief: Brief,
  opportunities: Opportunity[],
  editedBrief?: EditableBrief,
) {
  return brief.topOpportunities.map((opportunityId, index) => {
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    const editedOpportunity =
      editedBrief?.topOpportunities.find((item) => item.id === opportunityId) ??
      editedBrief?.topOpportunities[index];

    return {
      id: opportunityId,
      title: editedOpportunity?.title ?? opportunity?.pitch ?? opportunityId,
      description:
        editedOpportunity?.description ??
        opportunity?.expectedImpact ??
        opportunityId,
      confidence: opportunity?.confidence ?? brief.overallConfidence,
      score: opportunity?.score,
      feature: opportunity?.feature,
      evidence: opportunity?.evidence ?? [],
    };
  });
}

export function buildOutlineWithConfidence(
  brief: Brief,
  goals: Goal[],
  usage: UsageItem[],
  gaps: Gap[],
  opportunities: Opportunity[],
  editedBrief?: EditableBrief,
) {
  const effectiveOutline = editedBrief?.qbrOutline ?? brief.qbrOutline;
  const topGaps = resolveTopGapExports(brief, gaps, editedBrief);
  const topOpportunities = resolveTopOpportunityExports(brief, opportunities, editedBrief);

  return [
    {
      title: "Goals",
      items: effectiveOutline.goals.map((text, index) => ({
        text,
        confidence: goals[index]?.confidence ?? brief.overallConfidence,
      })),
    },
    {
      title: "Performance",
      items: effectiveOutline.currentPerformance.map((text, index) => ({
        text,
        confidence: usage[index]?.confidence ?? brief.overallConfidence,
      })),
    },
    {
      title: "Gaps",
      items: effectiveOutline.gaps.map((text, index) => ({
        text,
        confidence: topGaps[index]?.confidence ?? brief.overallConfidence,
      })),
    },
    {
      title: "Opportunities",
      items: effectiveOutline.opportunities.map((text, index) => ({
        text,
        confidence: topOpportunities[index]?.confidence ?? brief.overallConfidence,
      })),
    },
    {
      title: "Asks",
      items: effectiveOutline.asks.map((text) => ({
        text,
        confidence: brief.overallConfidence,
      })),
    },
  ];
}
