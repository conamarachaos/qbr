# Stack & Dependencies

## Core
- **Next.js 15** (App Router, TypeScript, Turbopack)
- **React 19**
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)

## AI / orchestration
- **ai** (Vercel AI SDK 6) — `generateObject`, `streamObject`, `streamText`
- **@ai-sdk/anthropic** — Claude provider (Sonnet 4.6 extraction, Opus 4.8 narrative)
- **@ai-sdk/openai** — optional fallback provider
- **zod** — schemas + structured-output validation

## Retrieval (optional, scale)
- **pgvector** via Postgres — when transcript corpus is large
- **@ai-sdk/voyage** or Voyage API — embeddings (voyage-3); hybrid semantic + keyword

## Export
- **pptxgenjs** — QBR deck (.pptx)
- **@react-pdf/renderer** or **md-to-pdf** — brief PDF

## Persistence (optional MVP)
- **Prisma** + SQLite (dev) / Postgres (prod) — accounts, runs, briefs
- MVP can run stateless (file/in-memory) and add Prisma in Day 3+

## Tooling
- ESLint + Prettier
- Vitest (unit: schema validation, pipeline glue, catalog invariants)
- Playwright (e2e: upload → run → export) — optional

## Env vars
```
ANTHROPIC_API_KEY=        # required
OPENAI_API_KEY=           # optional fallback
VOYAGE_API_KEY=           # optional (embeddings, scale)
DATABASE_URL=             # optional (Prisma)
EXTRACTION_MODEL=claude-sonnet-4-6
NARRATIVE_MODEL=claude-opus-4-8
```

## Why not LangChain (MVP)
Fixed 5-stage linear chain with typed handoffs → Vercel AI SDK's `generateObject` +
plain TypeScript orchestration is lighter, fully typed, and easier to debug. Revisit
LangGraph only if we add branching/cycles/human-in-the-loop.
