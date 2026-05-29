import { getExtractionModel } from "@/lib/models";
import { type GenerateObjectLike, runStructuredStage } from "@/lib/pipeline/shared";
import {
  GapsResult,
  GoalsResult,
  OpportunitiesSchema,
  type OpportunitiesResult,
  validateOpportunityInvariants,
} from "@/lib/schemas";
import { buildStage4Prompt } from "@/prompts/stage4-opportunities";

export async function runStage4Opportunities(
  gaps: GapsResult,
  goals: GoalsResult,
  options?: { generateObject?: GenerateObjectLike },
) {
  return runStructuredStage<OpportunitiesResult>({
    stageName: "Stage 4 - Opportunity Mapping",
    schemaName: "Opportunities",
    schema: OpportunitiesSchema,
    model: getExtractionModel(),
    prompt: buildStage4Prompt(gaps, goals),
    generateObjectImpl: options?.generateObject,
    validate: (result) => validateOpportunityInvariants(result.opportunities, gaps.gaps),
  });
}
