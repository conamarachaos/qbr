import { NormalizedAccountInput } from "@/lib/ingest";
import { getExtractionModel } from "@/lib/models";
import { type GenerateObjectLike, runStructuredStage } from "@/lib/pipeline/shared";
import { GapsSchema, GoalsResult, UsageResult, type GapsResult } from "@/lib/schemas";
import { buildStage3Prompt } from "@/prompts/stage3-gaps";

export async function runStage3Gaps(
  input: NormalizedAccountInput,
  goals: GoalsResult,
  usage: UsageResult,
  options?: { generateObject?: GenerateObjectLike },
) {
  return runStructuredStage<GapsResult>({
    stageName: "Stage 3 - Gap Detection",
    schemaName: "Gaps",
    schema: GapsSchema,
    model: getExtractionModel(),
    prompt: buildStage3Prompt(input, goals, usage),
    generateObjectImpl: options?.generateObject,
  });
}
