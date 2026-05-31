import type { NormalizedSource } from "@/lib/ingest";
import type { Evidence } from "@/lib/schemas";

/**
 * Quote grounding: confirm that every evidence quote a stage emits is actually
 * present in the source it cites. The schemas already *require* a quote string,
 * but a model can produce a plausible-but-fabricated quote that passes Zod. This
 * verifier closes that gap by checking the quote is a substring of the cited
 * source content (after whitespace normalization), turning "evidence-shaped"
 * output into "evidence-verified" output.
 */

export interface GroundingIssue {
  /** Identifier of the item the evidence belongs to (goal/gap/opportunity id). */
  itemId: string;
  /** Stage label, e.g. "Goal", "Gap", "Opportunity", "Usage". */
  label: string;
  sourceId: string;
  quote: string;
  reason: "unknown-source" | "quote-not-found";
}

export interface GroundedItem {
  id: string;
  evidence: Evidence[];
}

/**
 * Collapse runs of whitespace to a single space and lowercase, so quotes that
 * differ from the source only in formatting (line breaks, indentation, casing)
 * still match. We deliberately keep punctuation: a quote that drops or invents
 * words should not be treated as grounded.
 */
function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isQuoteGrounded(
  quote: string,
  sourceContent: string,
): boolean {
  const normalizedQuote = normalize(quote);
  if (!normalizedQuote) {
    return false;
  }
  return normalize(sourceContent).includes(normalizedQuote);
}

/**
 * Check one item's evidence against the source map. Returns the issues found
 * (empty array means fully grounded).
 */
export function verifyEvidence(
  label: string,
  item: GroundedItem,
  sourceMap: Record<string, NormalizedSource>,
): GroundingIssue[] {
  const issues: GroundingIssue[] = [];

  for (const evidence of item.evidence) {
    const source = sourceMap[evidence.sourceId];

    if (!source) {
      issues.push({
        itemId: item.id,
        label,
        sourceId: evidence.sourceId,
        quote: evidence.quote,
        reason: "unknown-source",
      });
      continue;
    }

    if (!isQuoteGrounded(evidence.quote, source.content)) {
      issues.push({
        itemId: item.id,
        label,
        sourceId: evidence.sourceId,
        quote: evidence.quote,
        reason: "quote-not-found",
      });
    }
  }

  return issues;
}

/**
 * Verify a batch of items and return both the issues and the items that remain
 * fully grounded. Callers decide whether to drop ungrounded items or surface the
 * issues to the user.
 */
export function verifyItems<T extends GroundedItem>(
  label: string,
  items: T[],
  sourceMap: Record<string, NormalizedSource>,
): { grounded: T[]; issues: GroundingIssue[] } {
  const grounded: T[] = [];
  const issues: GroundingIssue[] = [];

  for (const item of items) {
    const itemIssues = verifyEvidence(label, item, sourceMap);
    if (itemIssues.length === 0) {
      grounded.push(item);
    } else {
      issues.push(...itemIssues);
    }
  }

  return { grounded, issues };
}

export function formatGroundingIssue(issue: GroundingIssue): string {
  const detail =
    issue.reason === "unknown-source"
      ? `cites unknown source ${issue.sourceId}`
      : `quote not found in source ${issue.sourceId}`;
  return `${issue.label} ${issue.itemId} ${detail}: "${issue.quote}"`;
}
