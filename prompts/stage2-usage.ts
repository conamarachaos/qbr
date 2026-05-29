import { NormalizedAccountInput } from "@/lib/ingest";
import { GoalsResult } from "@/lib/schemas";

export function buildStage2Prompt(
  input: NormalizedAccountInput,
  goals: GoalsResult,
) {
  return `Account: ${input.accountName}

Goals:
${JSON.stringify(goals, null, 2)}

Usage context:
${input.usageContext}

Supporting transcript/email context:
${[input.transcriptContext, input.emailContext].filter(Boolean).join("\n\n")}

Task:
For each goal, assess whether current usage is working, partial, or lagging.
Use usage metrics when available. When usage is absent, rely on transcript/email evidence and lower confidence.

Each usage item needs:
- goalId
- status: working | partial | lagging
- metrics[] with label, value, optional context
- notes
- evidence[] with exact quotes
- confidence 0-1

Rules:
- "working" requires supporting metrics or a strong sourced statement.
- Cite exact snippets.
- Do not invent metrics.`;
}
