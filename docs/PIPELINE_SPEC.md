# Pipeline Spec — 5-Stage Prompt Chain

Each stage = one `generateObject` call (Vercel AI SDK) with a Zod schema. Output of
stage N is passed (typed) into stage N+1. All stages share the normalized account input.

## Shared types (Zod sketch)

```ts
const Evidence = z.object({
  sourceId: z.string(),            // e.g. "call-2026-03-12", "email-thread-7"
  sourceType: z.enum(["call","email","usage"]),
  quote: z.string(),               // exact snippet from source
});

const Confidence = z.number().min(0).max(1);
```

## Stage 1 — Goal Extraction

- **In:** transcripts + emails (usage optional for context).
- **Out:** `goals[]` — `{ id, title, description, evidence[], confidence }`
- **Rule:** only goals explicitly stated or strongly implied with a citation. No evidence → drop.

## Stage 2 — Usage Analysis

- **In:** `goals[]` + usage data.
- **Out:** `usage[]` — per goal: `{ goalId, status: "working"|"partial"|"lagging", metrics[], notes, evidence[], confidence }`
- **Rule:** map each goal to observed usage; "working" requires a supporting metric.

## Stage 3 — Gap Detection

- **In:** `goals[]` + `usage[]` + `PRODUCT_CATALOG`.
- **Out:** `gaps[]` — `{ id, goalId, feature, reason, severity: 1-5, evidence[], confidence }`
- **Rule:** gap = catalog feature that advances a goal but is underused/unenabled. "free value".

## Stage 4 — Opportunity Mapping

- **In:** `gaps[]` + `goals[]` + `PRODUCT_CATALOG`.
- **Out:** `opportunities[]` — `{ id, gapId, feature, pitch, expectedImpact, score: 0-1, evidence[] }`
- **Rules:** each opportunity references a `gapId`; `feature` ∈ catalog; ranked by score.
  Top 3 surfaced. Blocks invented upsells.

## Stage 5 — Narrative Generation

- **In:** all prior outputs.
- **Out:** `brief` —
  ```
  {
    accountName,
    summary,                 // goals + status narrative
    topGaps[3],              // refs gap ids
    topOpportunities[3],     // refs opp ids
    qbrOutline: { goals, currentPerformance, gaps, opportunities, asks[] },
    deckSlides[],            // title + bullets per slide for PPTX
    overallConfidence,
  }
  ```
- **Rule:** narrative may only reference items produced by earlier stages (no new facts).

## Orchestration

- Sequential `await` chain; stream stage status to UI via AI SDK data stream.
- On Zod validation failure: retry stage up to 2× with the validation error appended.
- Cost + token usage accumulated per run and returned.
- Stages tolerate empty inputs (e.g., no usage data) and lower confidence accordingly.
