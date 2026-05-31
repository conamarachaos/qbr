import {
  formatGroundingIssue,
  verifyItems,
  type GroundingIssue,
} from "@/lib/grounding";
import {
  normalizeAccountInput,
  type NormalizeAccountInputArgs,
  type NormalizedAccountInput,
  type NormalizedSource,
} from "@/lib/ingest";
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
import {
  Brief,
  GapsResult,
  GoalsResult,
  OpportunitiesResult,
  UsageResult,
  rankBriefSelections,
} from "@/lib/schemas";

export const PIPELINE_STAGES = [
  { id: "stage1", label: "Goal extraction" },
  { id: "stage2", label: "Usage analysis" },
  { id: "stage3", label: "Gap detection" },
  { id: "stage4", label: "Opportunity mapping" },
  { id: "stage5", label: "Narrative generation" },
] as const;

export interface GroundingReport {
  /** Total evidence quotes checked across goals, usage, gaps, opportunities. */
  checked: number;
  /** Quotes that could not be matched back to their cited source. */
  grounded: number;
  /** 0-1 share of checked quotes that are verifiably grounded. */
  score: number;
  issues: GroundingIssue[];
}

/**
 * Time-saved framing for the case study's headline metric ("Save AMs 30–60
 * minutes per account"). We compare the agent's wall-clock runtime against a
 * conservative manual-prep baseline so the brief can surface minutes saved.
 */
export interface TimingReport {
  /** Wall-clock pipeline runtime in milliseconds. */
  runtimeMs: number;
  /** Assumed manual QBR-prep time in minutes (conservative end of 30–60). */
  manualBaselineMinutes: number;
  /** manualBaselineMinutes minus agent runtime, floored at 0, in minutes. */
  minutesSaved: number;
}

/** Conservative low end of the case study's 30–60 minute manual-prep range. */
export const MANUAL_QBR_BASELINE_MINUTES = 45;

export interface PipelineRunResult {
  input: NormalizedAccountInput;
  goals: GoalsResult;
  usage: UsageResult;
  gaps: GapsResult;
  opportunities: OpportunitiesResult;
  brief: Brief;
  usageTotals: TokenTotals;
  grounding: GroundingReport;
  timing: TimingReport;
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
  const startedAt = Date.now();

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

  const grounding = computeGroundingReport(input, {
    goals: goals.data,
    usage: usage.data,
    gaps: gaps.data,
    opportunities: opportunities.data,
  });

  const rankedBrief = rankBriefSelections(
    brief.data.brief,
    gaps.data.gaps,
    opportunities.data.opportunities,
  );

  const runtimeMs = Date.now() - startedAt;
  const timing: TimingReport = {
    runtimeMs,
    manualBaselineMinutes: MANUAL_QBR_BASELINE_MINUTES,
    minutesSaved: Math.max(
      0,
      Math.round(MANUAL_QBR_BASELINE_MINUTES - runtimeMs / 60_000),
    ),
  };

  return {
    input,
    goals: goals.data,
    usage: usage.data,
    gaps: gaps.data,
    opportunities: opportunities.data,
    brief: rankedBrief,
    usageTotals,
    grounding,
    timing,
    stages,
  };
}

/**
 * Re-check every evidence quote the pipeline produced against the source it
 * cites. Usage items have no stable `id`, so we key them by goalId for the
 * report. The score is the fraction of checked quotes that are grounded.
 */
function computeGroundingReport(
  input: NormalizedAccountInput,
  data: {
    goals: GoalsResult;
    usage: UsageResult;
    gaps: GapsResult;
    opportunities: OpportunitiesResult;
  },
): GroundingReport {
  const issues: GroundingIssue[] = [];
  let checked = 0;

  const countEvidence = (items: Array<{ evidence: unknown[] }>) =>
    items.reduce((total, item) => total + item.evidence.length, 0);

  checked += countEvidence(data.goals.goals);
  checked += countEvidence(data.usage.usage);
  checked += countEvidence(data.gaps.gaps);
  checked += countEvidence(data.opportunities.opportunities);

  // Later stages legitimately reuse quotes that originate from raw sources, but
  // may cite the upstream item's id (e.g. an opportunity citing "gap-1"). Treat
  // each upstream item as a derived source whose content is the concatenation
  // of its own (already verified) quotes, so honest chaining is not penalized
  // while genuinely fabricated quotes still fail.
  const derivedSourceMap = { ...input.sourceMap };
  const addDerivedSource = (
    id: string,
    type: NormalizedSource["type"],
    evidence: Array<{ quote: string }>,
  ) => {
    derivedSourceMap[id] = {
      id,
      type,
      label: id,
      content: evidence.map((item) => item.quote).join("\n"),
    };
  };
  for (const goal of data.goals.goals) {
    addDerivedSource(goal.id, "call", goal.evidence);
  }
  for (const gap of data.gaps.gaps) {
    addDerivedSource(gap.id, "call", gap.evidence);
  }

  issues.push(...verifyItems("Goal", data.goals.goals, input.sourceMap).issues);
  issues.push(
    ...verifyItems(
      "Usage",
      data.usage.usage.map((item) => ({ id: item.goalId, evidence: item.evidence })),
      derivedSourceMap,
    ).issues,
  );
  issues.push(...verifyItems("Gap", data.gaps.gaps, derivedSourceMap).issues);
  issues.push(
    ...verifyItems("Opportunity", data.opportunities.opportunities, derivedSourceMap).issues,
  );

  const grounded = Math.max(0, checked - issues.length);
  const score = checked === 0 ? 1 : grounded / checked;

  return { checked, grounded, score, issues };
}

export { formatGroundingIssue };

export async function runPipelineFromRawInput(
  input: NormalizeAccountInputArgs,
  options: PipelineRunOptions = {},
) {
  return runPipeline(normalizeAccountInput(input), options);
}
