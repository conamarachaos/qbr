import { z } from "zod";

import {
  applyEditedBrief,
  EditableBrief,
  resolveTopGapExports,
  resolveTopOpportunityExports,
} from "@/lib/brief-export";
import { Brief, Gap, Opportunity, QbrOutlineSchema } from "@/lib/schemas";

export const IntegrationClaimSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  feature: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  severity: z.number().int().min(1).max(5).optional(),
  score: z.number().min(0).max(1).optional(),
});

export const IntegrationBriefPayloadSchema = z.object({
  accountName: z.string().min(1),
  vertical: z.string().optional(),
  summary: z.string().min(1),
  overallConfidence: z.number().min(0).max(1),
  topGaps: z.array(IntegrationClaimSchema).max(3),
  topOpportunities: z.array(IntegrationClaimSchema).max(3),
  qbrOutline: QbrOutlineSchema,
});

export type IntegrationBriefPayload = z.infer<typeof IntegrationBriefPayloadSchema>;

export function buildIntegrationBriefPayload({
  brief,
  editedBrief,
  gaps,
  opportunities,
  vertical,
}: {
  brief: Brief;
  editedBrief?: EditableBrief;
  gaps: Gap[];
  opportunities: Opportunity[];
  vertical?: string;
}): IntegrationBriefPayload {
  const effectiveBrief = applyEditedBrief(brief, editedBrief);

  return {
    accountName: brief.accountName,
    vertical,
    summary: effectiveBrief.summary,
    overallConfidence: brief.overallConfidence,
    topGaps: resolveTopGapExports(brief, gaps, editedBrief),
    topOpportunities: resolveTopOpportunityExports(brief, opportunities, editedBrief),
    qbrOutline: effectiveBrief.qbrOutline,
  };
}
