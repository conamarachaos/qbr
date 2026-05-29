import { getCatalogContext } from "@/lib/catalog";
import { NormalizedAccountInput } from "@/lib/ingest";
import { GoalsResult, UsageResult } from "@/lib/schemas";

export function buildStage3Prompt(
  input: NormalizedAccountInput,
  goals: GoalsResult,
  usage: UsageResult,
) {
  return `Account: ${input.accountName}

Goals:
${JSON.stringify(goals, null, 2)}

Usage analysis:
${JSON.stringify(usage, null, 2)}

Allowed product catalog:
${getCatalogContext()}

Task:
Identify adoption gaps where a real catalog feature would advance a customer goal but is underused, not enabled, or blocked.

Each gap needs:
- id
- goalId
- feature
- reason
- severity (1-5)
- evidence[] with exact quotes
- confidence 0-1

Rules:
- Feature must come from the catalog.
- Tie each gap to a goalId.
- Gaps must be grounded in the source material or attached usage.`;
}
