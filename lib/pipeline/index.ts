import { normalizeAccountInput, type NormalizeAccountInputArgs, type NormalizedAccountInput } from "@/lib/ingest";
import {
  addUsage,
  emptyUsage,
  type GenerateObjectLike,
  type StageProgressEvent,
  type TokenTotals,
} from "@/lib/pipeline/shared";
import { runStage1Goals } from "@/lib/pipeline/stage1-goals";
import { runStage2Usage } from "@/lib/pipeline/stage2-usage";
import { runStage3Gaps } from "@/lib/pipeline/stage3-gaps";
import { runStage4Opportunities } from "@/lib/pipeline/stage4-opportunities";
import { runStage5Narrative } from "@/lib/pipeline/stage5-narrative";
import { Brief, GapsResult, GoalsResult, OpportunitiesResult, UsageResult } from "@/lib/schemas";

export const PIPELINE_STAGES = [
  { id: "stage1", label: "Goal extraction" },
  { id: "stage2", label: "Usage analysis" },
  { id: "stage3", label: "Gap detection" },
  { id: "stage4", label: "Opportunity mapping" },
  { id: "stage5", label: "Narrative generation" },
] as const;

export interface PipelineRunResult {
  input: NormalizedAccountInput;
  goals: GoalsResult;
  usage: UsageResult;
  gaps: GapsResult;
  opportunities: OpportunitiesResult;
  brief: Brief;
  usageTotals: TokenTotals;
  stages: Array<{
    id: (typeof PIPELINE_STAGES)[number]["id"];
    label: string;
    attempts: number;
    modelId: string;
    usage: TokenTotals;
  }>;
}

export interface PipelineRunOptions {
  onStage?: (event: StageProgressEvent) => void;
  generateObject?: GenerateObjectLike;
}

function emit(onStage: PipelineRunOptions["onStage"], event: StageProgressEvent) {
  onStage?.(event);
}

export async function runPipeline(
  input: NormalizedAccountInput,
  options: PipelineRunOptions = {},
): Promise<PipelineRunResult> {
  const stages: PipelineRunResult["stages"] = [];
  let usageTotals = emptyUsage();

  emit(options.onStage, {
    stage: PIPELINE_STAGES[0].id,
    status: "running",
    message: "Extracting grounded customer goals.",
  });
  const goals = await runStage1Goals(input, { generateObject: options.generateObject });
  usageTotals = addUsage(usageTotals, goals.usage);
  stages.push({
    id: PIPELINE_STAGES[0].id,
    label: PIPELINE_STAGES[0].label,
    attempts: goals.attempts,
    modelId: goals.modelId,
    usage: goals.usage,
  });
  emit(options.onStage, {
    stage: PIPELINE_STAGES[0].id,
    status: "completed",
    attempts: goals.attempts,
    usage: goals.usage,
  });

  emit(options.onStage, {
    stage: PIPELINE_STAGES[1].id,
    status: "running",
    message: "Assessing goal progress against usage signals.",
  });
  const usage = await runStage2Usage(input, goals.data, {
    generateObject: options.generateObject,
  });
  usageTotals = addUsage(usageTotals, usage.usage);
  stages.push({
    id: PIPELINE_STAGES[1].id,
    label: PIPELINE_STAGES[1].label,
    attempts: usage.attempts,
    modelId: usage.modelId,
    usage: usage.usage,
  });
  emit(options.onStage, {
    stage: PIPELINE_STAGES[1].id,
    status: "completed",
    attempts: usage.attempts,
    usage: usage.usage,
  });

  emit(options.onStage, {
    stage: PIPELINE_STAGES[2].id,
    status: "running",
    message: "Finding adoption gaps tied to customer goals.",
  });
  const gaps = await runStage3Gaps(input, goals.data, usage.data, {
    generateObject: options.generateObject,
  });
  usageTotals = addUsage(usageTotals, gaps.usage);
  stages.push({
    id: PIPELINE_STAGES[2].id,
    label: PIPELINE_STAGES[2].label,
    attempts: gaps.attempts,
    modelId: gaps.modelId,
    usage: gaps.usage,
  });
  emit(options.onStage, {
    stage: PIPELINE_STAGES[2].id,
    status: "completed",
    attempts: gaps.attempts,
    usage: gaps.usage,
  });

  emit(options.onStage, {
    stage: PIPELINE_STAGES[3].id,
    status: "running",
    message: "Ranking expansion opportunities from grounded gaps.",
  });
  const opportunities = await runStage4Opportunities(gaps.data, goals.data, {
    generateObject: options.generateObject,
    vertical: input.usage?.vertical,
  });
  usageTotals = addUsage(usageTotals, opportunities.usage);
  stages.push({
    id: PIPELINE_STAGES[3].id,
    label: PIPELINE_STAGES[3].label,
    attempts: opportunities.attempts,
    modelId: opportunities.modelId,
    usage: opportunities.usage,
  });
  emit(options.onStage, {
    stage: PIPELINE_STAGES[3].id,
    status: "completed",
    attempts: opportunities.attempts,
    usage: opportunities.usage,
  });

  emit(options.onStage, {
    stage: PIPELINE_STAGES[4].id,
    status: "running",
    message: "Assembling the QBR-ready brief and slide outline.",
  });
  const brief = await runStage5Narrative(
    {
      accountName: input.accountName,
      goals: goals.data,
      usage: usage.data,
      gaps: gaps.data,
      opportunities: opportunities.data,
    },
    { generateObject: options.generateObject },
  );
  usageTotals = addUsage(usageTotals, brief.usage);
  stages.push({
    id: PIPELINE_STAGES[4].id,
    label: PIPELINE_STAGES[4].label,
    attempts: brief.attempts,
    modelId: brief.modelId,
    usage: brief.usage,
  });
  emit(options.onStage, {
    stage: PIPELINE_STAGES[4].id,
    status: "completed",
    attempts: brief.attempts,
    usage: brief.usage,
  });

  return {
    input,
    goals: goals.data,
    usage: usage.data,
    gaps: gaps.data,
    opportunities: opportunities.data,
    brief: brief.data.brief,
    usageTotals,
    stages,
  };
}

export async function runPipelineFromRawInput(
  input: NormalizeAccountInputArgs,
  options: PipelineRunOptions = {},
) {
  return runPipeline(normalizeAccountInput(input), options);
}
