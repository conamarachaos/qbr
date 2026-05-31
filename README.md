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

### Trust & rigor

- **Quote-grounding verifier** ([`lib/grounding.ts`](lib/grounding.ts)) — every evidence
  quote is re-checked against the source it cites (whitespace/case-normalized substring
  match). Fabricated quotes are flagged and surfaced as a 0–1 **grounding score** on the
  brief, and fail the eval harness. This catches hallucinated evidence that still passes
  schema validation.
- **Scoring drives selection** — `topGaps`/`topOpportunities` are re-ranked in code by
  severity/score ([`rankBriefSelections`](lib/schemas.ts)), so the model's reasoning is
  scored deterministically rather than the model freely picking its "top 3".
- **Time-saved metric** — each run reports wall-clock runtime vs. a 45-min manual-prep
  baseline (the case study's headline metric), shown on the brief.
- **Grounded account Q&A** — the **Ask** tab on an account lets AMs ask follow-up questions
  ("why is this account at risk?", "which gap backs the top upsell?"). Answers come *only*
  from that account's saved signals (retrieved via **pgvector** over OpenAI
  `text-embedding-3-small` embeddings) plus its latest persisted brief, and every cited quote
  is re-checked with the same [`isQuoteGrounded`](lib/grounding.ts) verifier — quotes that
  don't match their source are flagged "unverified" in the UI rather than trusted. It refuses
  to answer when the signals don't cover the question, and is scoped per-account by the same
  workspace/ownership rules as everything else (it never sees another account's data). Without
  `OPENAI_API_KEY` it falls back to a deterministic local embedding so the demo still runs offline.

> **Integrations are mock adapters.** CRM ([`lib/integrations/crm.ts`](lib/integrations/crm.ts))
> and Slack ([`lib/integrations/slack.ts`](lib/integrations/slack.ts)) ship as interfaces
> with in-memory mock implementations (swap-in ready). Setting a real Salesforce/HubSpot/Slack
> token currently throws by design — no live external calls are made.

## Stack

Next.js 15 · TypeScript · Vercel AI SDK 6 · Zod · Claude (Sonnet/Opus) · Tailwind +
shadcn/ui · PptxGenJS. See [`docs/STACK.md`](docs/STACK.md).

## Docs

- [`docs/USAGE_GUIDE.md`](docs/USAGE_GUIDE.md) — **how to run it**: inputs, flow, and what to expect per feature
- [`docs/PRD.md`](docs/PRD.md) — product requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design + anti-hallucination
- [`docs/PIPELINE_SPEC.md`](docs/PIPELINE_SPEC.md) — 5-stage chain spec
- [`docs/STACK.md`](docs/STACK.md) — deps + env
- [`docs/TODO.md`](docs/TODO.md) — implementation backlog

## Quick start

```bash
npm install
cp .env.example .env
docker compose up -d postgres
```

The Postgres container is published on `localhost:5433` for host-side development and is also
reachable inside the aidev task container at `qbr-agent-postgres:5432` once it is attached to
the same Docker network. In this runtime the shared network is `aidev_default`.

If the container is already running but not attached to the task network yet:

```bash
docker network connect aidev_default qbr-agent-postgres
```

Use the internal URL for containerized Prisma commands:

```bash
export DATABASE_URL=postgresql://postgres:postgres@qbr-agent-postgres:5432/qbr_agent?schema=public
npx prisma migrate dev --name init
npm run seed
```

If you are running `npm run dev` directly on the host instead of inside the task container, set
`DATABASE_URL` to the `DATABASE_URL_HOST` value from [`.env.example`](.env.example).

Then start the app:

```bash
npm run dev
```

Open `http://localhost:3000` and sign in with one of the seeded demo users:

- `admin@demo` / `demo1234`
- `lead@demo` / `demo1234`
- `am@demo` / `demo1234`

Validation:

```bash
npx prisma validate
npm run lint
npm test
npm run build
```
