import { getNarrativeModel } from "@/lib/models";
import { type GenerateObjectLike, runStructuredStage } from "@/lib/pipeline/shared";
import {
  GapsResult,
  GoalsResult,
  NarrativeSchema,
  OpportunitiesResult,
  UsageResult,
  type NarrativeResult,
  validateNarrativeInvariants,
} from "@/lib/schemas";
import { buildStage5Prompt } from "@/prompts/stage5-narrative";

interface Stage5Args {
  accountName: string;
  goals: GoalsResult;
  usage: UsageResult;
  gaps: GapsResult;
  opportunities: OpportunitiesResult;
}

export async function runStage5Narrative(
  args: Stage5Args,
  options?: { generateObject?: GenerateObjectLike },
) {
  return runStructuredStage<NarrativeResult>({
    stageName: "Stage 5 - Narrative Generation",
    schemaName: "Brief",
    schema: NarrativeSchema,
    model: getNarrativeModel(),
    prompt: buildStage5Prompt(args),
    generateObjectImpl: options?.generateObject,
    validate: (result) =>
      validateNarrativeInvariants(
        result.brief,
        args.gaps.gaps,
        args.opportunities.opportunities,
      ),
  });
}
