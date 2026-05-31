import { getCatalogContext } from "@/lib/catalog";
import { GapsResult, GoalsResult } from "@/lib/schemas";

export function buildStage4Prompt(
  gaps: GapsResult,
  goals: GoalsResult,
  vertical?: string,
) {
  const relevantFeatures = Array.from(new Set(gaps.gaps.map((gap) => gap.feature)));

  return `Goals:
${JSON.stringify(goals, null, 2)}

Gaps:
${JSON.stringify(gaps, null, 2)}

Relevant product catalog${vertical ? ` (${vertical})` : ""}:
${getCatalogContext(relevantFeatures, {
  vertical,
  includePlaybooks: true,
})}

Task:
Map expansion opportunities directly from detected gaps.
Each opportunity must reference a real gap and a real catalog feature.

Each opportunity needs:
- id
- gapId
- feature
- title (a concise label, max ~6 words / 80 chars, e.g. "Automate review responses for SMB tier")
- pitch (the full one-to-two sentence expansion pitch)
- expectedImpact
- score 0-1
- confidence 0-1
- evidence[] with exact quotes

Rules:
- No invented upsells.
- Every opportunity must point to a gapId.
- Prefer the strongest three opportunities by score, but return all grounded opportunities.`;
}
