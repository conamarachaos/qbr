import { NormalizedAccountInput } from "@/lib/ingest";
import { GoalsResult } from "@/lib/schemas";

export function buildStage2Prompt(
  input: NormalizedAccountInput,
  goals: GoalsResult,
) {
  return `Account: ${input.accountName}

Goals (each already carries the exact source quotes that support it):
${JSON.stringify(goals, null, 2)}

Usage context:
${input.usageContext}

Task:
For each goal, assess whether current usage is working, partial, or lagging.
Use usage metrics when available. When usage is absent, rely on the evidence quotes already attached to each goal and lower confidence.

Each usage item needs:
- goalId
- status: working | partial | lagging
- metrics[] with label, value, optional context
- notes
- evidence[] with exact quotes
- confidence 0-1

Evidence rules:
- You may cite two kinds of evidence, and nothing else:
  1. The goal's existing evidence quotes, reused verbatim.
  2. Lines from the usage source above, copied verbatim (use sourceId "${input.usage?.sourceId ?? "usage-1"}", sourceType "usage").
- Do not invent quotes or metrics that are not present in the goal evidence or the usage source.

Rules:
- "working" requires supporting metrics or a strong sourced statement.
- Cite exact snippets.
- Do not invent metrics.`;
}
