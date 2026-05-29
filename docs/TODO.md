# Implementation Backlog — QBR Agent

Mapped to the 5-day plan. Check off as completed.

## Day 1–2 — MVP pipeline + static prompts

- [ ] Scaffold Next.js 15 + TS + Tailwind + shadcn/ui (`create-next-app`)
- [ ] Add deps: `ai @ai-sdk/anthropic zod pptxgenjs`
- [ ] `.env.example` + `lib/models.ts` (Claude Sonnet/Opus, provider abstraction)
- [ ] `lib/schemas.ts` — Evidence, Goals, Usage, Gaps, Opps, Brief (Zod)
- [ ] `lib/catalog.ts` — PRODUCT_CATALOG feature allowlist (Reviews, Webchat, Messaging, Payments)
- [ ] `lib/ingest.ts` — normalize calls/emails/usage into NormalizedAccountInput
- [ ] `prompts/*` — system + 5 stage prompt templates (grounding-first)
- [ ] `lib/pipeline/stage1..5.ts` — one `generateObject` per stage
- [ ] `lib/pipeline/index.ts` — sequential orchestrator + retry-on-validation-fail
- [ ] `app/api/run/route.ts` — POST, stream stage progress
- [ ] `app/page.tsx` — upload/paste UI (calls, emails, usage)
- [ ] `app/accounts/[id]/page.tsx` — brief render (summary, gaps, opps, outline)
- [ ] Wire sample account (Acme Dental) → run pipeline → render brief
- [ ] Vitest: schema validation + catalog invariant tests

## Day 3–4 — reasoning, anti-hallucination, scoring, export

- [ ] Enforce evidence spans on every item; drop/flag items lacking citations
- [ ] Confidence scoring per item + overall; UI confidence badges
- [ ] Gap severity + opportunity scoring → rank, surface Top 3 each
- [ ] Gap→opportunity invariant + feature-allowlist guard (block invented upsells)
- [ ] Inline citation UI (click claim → see source snippet)
- [ ] Streaming stage progress component
- [ ] `lib/deck.ts` + `app/api/export/pptx/route.ts` — PptxGenJS QBR deck
- [ ] `lib/pdf.ts` + `app/api/export/pdf/route.ts` — brief PDF
- [ ] Editable brief (AM edits before export)
- [ ] Per-run cost + token usage display
- [ ] (Scale) `lib/retrieve.ts` — semantic chunking + pgvector hybrid search for long corpora

## Day 5 — personalization + integration stubs + polish

- [ ] Per-product playbooks (catalog entries carry pitch templates)
- [ ] Account persistence via Prisma (accounts, runs, briefs)
- [ ] CRM integration stub (interface + mock Salesforce/HubSpot adapter)
- [ ] Slack delivery stub (post brief summary to channel)
- [ ] Eval harness: run sample accounts, compare vs. expected brief
- [ ] UI polish (baseline-ui pass), empty/error states, loading
- [ ] README run instructions + demo script

## Cross-cutting / DoD

- [ ] Every output claim cited + confidence-scored
- [ ] No upsell without a backing gap + catalog feature
- [ ] Full pipeline < 60s on sample account
- [ ] Tests green; `npm run build` clean
