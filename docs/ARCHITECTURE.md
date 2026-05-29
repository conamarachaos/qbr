# Architecture — QBR Agent

## Decision summary

| Concern | Choice | Why |
|---|---|---|
| App framework | **Next.js 15 (App Router) + TypeScript** | Requested; SSR + API routes + streaming UI in one codebase |
| LLM orchestration | **Vercel AI SDK 6** (`generateObject`, `streamText`) | First-class structured output w/ Zod + auto-retry; small bundle; native Next.js streaming. No LangChain dep for a 5-stage chain |
| Schema/validation | **Zod** | Compile-time types + runtime validation; powers `generateObject` |
| Models | **Anthropic Claude** (Sonnet for extraction/analysis, Opus for narrative) + provider-swappable | Strong structured reasoning; case study tolerant of any provider. OpenAI as fallback |
| Embeddings / retrieval | **pgvector** (when corpus large) + hybrid (semantic + keyword) | Long transcripts; semantic chunking ~300-token windows. MVP can skip RAG and pass full text |
| Deck generation | **PptxGenJS** | Zero-dep, runs in Node API route, real .pptx output (PowerPoint/Keynote/Slides compatible) |
| Brief export | **react-pdf / markdown → PDF** | Editable brief; PDF for sharing |
| UI | **Tailwind + shadcn/ui** | Fast, clean, consistent with BESWAS apps |
| State / DB (MVP) | **SQLite/Postgres via Prisma** (optional) or in-memory + file | Persist accounts/runs; MVP can run stateless |
| Styling | Tailwind | matches existing stack |

> **Pattern note (2026):** Vercel AI SDK on Next.js is sufficient for a fixed 5-stage
> prompt chain. LangGraph/LangChain is only warranted if we need branching, cycles, or
> human-in-the-loop checkpoints — out of scope for MVP. Keep orchestration in plain TS.

## High-level flow

```
                       ┌─────────────────────────────────────────────┐
  Upload/paste  ──────▶│  Ingestion: normalize calls/emails/usage     │
  (calls, emails,      │  → clean, segment, (optional) chunk+embed     │
   usage CSV/JSON)     └───────────────────┬─────────────────────────┘
                                           │ NormalizedAccountInput
                                           ▼
        ┌──────────────────── Prompt Chain (Vercel AI SDK generateObject) ───────────────────┐
        │ 1. Goal Extraction   → GoalsSchema      (goals[] w/ evidence spans + confidence)    │
        │ 2. Usage Analysis    → UsageSchema      (per-goal: working / lagging, metrics)      │
        │ 3. Gap Detection     → GapsSchema       (underused features tied to goals)          │
        │ 4. Opportunity Map   → OppsSchema       (upsells: gap → feature, rationale, score)  │
        │ 5. Narrative Gen     → BriefSchema      (summary, outline, asks)                     │
        └───────────────────────────────────────┬──────────────────────────────────────────┘
                                                 │ AccountBrief (validated)
                              ┌──────────────────┼───────────────────┐
                              ▼                   ▼                   ▼
                       Editable brief        PPTX deck           PDF / Markdown
                       (UI, streaming)      (PptxGenJS)          (export)
```

## Anti-hallucination strategy (core)

1. **Grounding-first prompts** — each stage receives only relevant context; instruct
   "extract only what is explicitly supported."
2. **Evidence spans** — every goal/gap/opportunity must include `evidence[]` quoting the
   exact source snippet + source id. No evidence → item dropped or flagged.
3. **Confidence scoring** — each item carries `confidence` (0–1); UI badges low scores.
4. **Constrained decoding** — `generateObject` + Zod schema forces structural validity;
   bounded retries on validation failure.
5. **Feature allowlist** — opportunities must map to a real product feature from a
   `PRODUCT_CATALOG` (Reviews, Webchat, Messaging, Payments…) to block invented upsells.
6. **Gap→opportunity invariant** — every opportunity references a detected gap id.

## Module layout

```
src/
  app/
    page.tsx                 # account input + run UI
    accounts/[id]/page.tsx   # brief view (editable, streaming)
    api/
      run/route.ts           # POST: kick off pipeline (streams stages)
      export/pptx/route.ts   # POST brief → .pptx
      export/pdf/route.ts    # POST brief → .pdf
  lib/
    pipeline/
      index.ts               # orchestrator: runs 5 stages in sequence
      stage1-goals.ts
      stage2-usage.ts
      stage3-gaps.ts
      stage4-opportunities.ts
      stage5-narrative.ts
    schemas.ts               # Zod schemas (Goals, Usage, Gaps, Opps, Brief)
    models.ts                # provider/model config (Claude Sonnet/Opus, fallback)
    ingest.ts                # normalize + (optional) chunk/embed
    catalog.ts               # PRODUCT_CATALOG (feature allowlist)
    deck.ts                  # PptxGenJS deck builder
    pdf.ts                   # brief → PDF
  components/                # uploaders, stage progress, brief sections, citations
  prompts/                   # system + per-stage prompt templates
data/samples/                # Podium-style sample account(s)
```

## Models config

- `EXTRACTION_MODEL` = `claude-sonnet-4-6` (goals, usage, gaps, opps)
- `NARRATIVE_MODEL`  = `claude-opus-4-8` (brief + deck copy)
- Provider abstraction via AI SDK so OpenAI/others are drop-in.
- Env: `ANTHROPIC_API_KEY`, optional `OPENAI_API_KEY`, optional `VOYAGE_API_KEY` (embeddings).
