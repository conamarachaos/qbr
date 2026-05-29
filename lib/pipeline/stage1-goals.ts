import { NormalizedAccountInput } from "@/lib/ingest";
import { getExtractionModel } from "@/lib/models";
import { GoalsSchema, type GoalsResult } from "@/lib/schemas";
import { runStructuredStage, type GenerateObjectLike } from "@/lib/pipeline/shared";
import { buildStage1Prompt } from "@/prompts/stage1-goals";

export async function runStage1Goals(
  input: NormalizedAccountInput,
  options?: { generateObject?: GenerateObjectLike },
) {
  return runStructuredStage<GoalsResult>({
    stageName: "Stage 1 - Goal Extraction",
    schemaName: "Goals",
    schema: GoalsSchema,
    model: getExtractionModel(),
    prompt: buildStage1Prompt(input),
    generateObjectImpl: options?.generateObject,
  });
}
