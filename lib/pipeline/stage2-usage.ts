import { NormalizedAccountInput } from "@/lib/ingest";
import { getExtractionModel } from "@/lib/models";
import { type GenerateObjectLike, runStructuredStage } from "@/lib/pipeline/shared";
import { GoalsResult, UsageSchema, type UsageResult } from "@/lib/schemas";
import { buildStage2Prompt } from "@/prompts/stage2-usage";

export async function runStage2Usage(
  input: NormalizedAccountInput,
  goals: GoalsResult,
  options?: { generateObject?: GenerateObjectLike },
) {
  return runStructuredStage<UsageResult>({
    stageName: "Stage 2 - Usage Analysis",
    schemaName: "Usage",
    schema: UsageSchema,
    model: getExtractionModel(),
    prompt: buildStage2Prompt(input, goals),
    generateObjectImpl: options?.generateObject,
  });
}
