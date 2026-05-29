import {
  GapsResult,
  GoalsResult,
  OpportunitiesResult,
  UsageResult,
} from "@/lib/schemas";

export function buildStage5Prompt(args: {
  accountName: string;
  goals: GoalsResult;
  usage: UsageResult;
  gaps: GapsResult;
  opportunities: OpportunitiesResult;
}) {
  return `Account: ${args.accountName}

Goals:
${JSON.stringify(args.goals, null, 2)}

Usage analysis:
${JSON.stringify(args.usage, null, 2)}

Gaps:
${JSON.stringify(args.gaps, null, 2)}

Opportunities:
${JSON.stringify(args.opportunities, null, 2)}

Task:
Create a QBR-ready brief that only references information already present in the goals, usage, gaps, and opportunities objects above.

The brief needs:
- accountName
- summary
- topGaps (max 3 gap ids)
- topOpportunities (max 3 opportunity ids)
- qbrOutline with goals, currentPerformance, gaps, opportunities, asks
- deckSlides[] with title and bullets
- overallConfidence 0-1

Rules:
- No new facts.
- Narrative may only reference earlier stage items.
- Keep the summary concise and executive-ready.`;
}
