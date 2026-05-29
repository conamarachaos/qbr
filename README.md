# QBR Agent — AI Account Review & Expansion Agent

Turns fragmented customer signals (call transcripts, email threads, usage data) into a
QBR-ready account brief + customer-facing deck. Built for Account Managers to cut QBR
prep from ~60 min to minutes, with grounded, cited, confidence-scored insights.

> Podium "AI GTM Engineer" case study implementation.

## What it does

1. **Goal Extraction** — customer objectives from calls/emails (with evidence)
2. **Usage Analysis** — goals vs. actual product usage
3. **Gap Detection** — underused features tied to goals ("free value")
4. **Opportunity Mapping** — upsells grounded in real gaps + product catalog
5. **Narrative Generation** — QBR brief + short deck (PPTX)

Every claim is **cited** to a source snippet and **confidence-scored**.

## Stack

Next.js 15 · TypeScript · Vercel AI SDK 6 · Zod · Claude (Sonnet/Opus) · Tailwind +
shadcn/ui · PptxGenJS. See [`docs/STACK.md`](docs/STACK.md).

## Docs

- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design + anti-hallucination
- [`docs/PIPELINE_SPEC.md`](docs/PIPELINE_SPEC.md) — 5-stage chain spec
- [`docs/STACK.md`](docs/STACK.md) — deps + env
- [`docs/TODO.md`](docs/TODO.md) — implementation backlog

## Quick start

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```
