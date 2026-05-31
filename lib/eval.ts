import type { GroundingReport, PipelineRunResult } from "@/lib/pipeline";
import { isCatalogFeature } from "@/lib/catalog";
import { formatGroundingIssue } from "@/lib/grounding";
import {
  validateNarrativeInvariants,
  validateOpportunityInvariants,
} from "@/lib/schemas";

type EvalTarget = Pick<
  PipelineRunResult,
  "goals" | "gaps" | "opportunities" | "brief"
> & {
  /** Optional grounding report; when present, failed quotes become eval errors. */
  grounding?: GroundingReport;
};

function collectEvidenceErrors(
  label: string,
  items: Array<{ id: string; evidence: unknown[] }>,
) {
  return items
    .filter((item) => item.evidence.length < 1)
    .map((item) => `${label} ${item.id} is missing evidence.`);
}

export function evaluatePipelineStructure(result: EvalTarget) {
  const errors = [
    ...collectEvidenceErrors("Goal", result.goals.goals),
    ...collectEvidenceErrors("Gap", result.gaps.gaps),
    ...collectEvidenceErrors("Opportunity", result.opportunities.opportunities),
  ];

  for (const opportunity of result.opportunities.opportunities) {
    if (!isCatalogFeature(opportunity.feature)) {
      errors.push(
        `Opportunity ${opportunity.id} references non-catalog feature ${opportunity.feature}.`,
      );
    }
  }

  try {
    validateOpportunityInvariants(
      result.opportunities.opportunities,
      result.gaps.gaps,
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    validateNarrativeInvariants(
      result.brief,
      result.gaps.gaps,
      result.opportunities.opportunities,
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const expectedTopGaps = Math.min(3, result.gaps.gaps.length);
  if (result.brief.topGaps.length !== expectedTopGaps) {
    errors.push(
      `Brief topGaps should contain ${expectedTopGaps} ids, received ${result.brief.topGaps.length}.`,
    );
  }

  const expectedTopOpportunities = Math.min(3, result.opportunities.opportunities.length);
  if (result.brief.topOpportunities.length !== expectedTopOpportunities) {
    errors.push(
      `Brief topOpportunities should contain ${expectedTopOpportunities} ids, received ${result.brief.topOpportunities.length}.`,
    );
  }

  if (
    result.brief.overallConfidence < 0 ||
    result.brief.overallConfidence > 1
  ) {
    errors.push(
      `Brief overallConfidence must be within [0,1], received ${result.brief.overallConfidence}.`,
    );
  }

  if (result.grounding) {
    for (const issue of result.grounding.issues) {
      errors.push(formatGroundingIssue(issue));
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
