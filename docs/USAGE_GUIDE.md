# QBR Agent — Usage Guide

How to run the **AI Account Review & Expansion Agent** end to end: what to provide, what
happens at each step, and what to expect for every feature described in the case study PDF.

This guide maps 1:1 to the Podium case study:
- **Inputs:** call transcripts, email threads, basic usage data
- **Outputs:** account summary (goals + status), top-3 adoption gaps, top-3 upsell
  opportunities, a simple QBR outline, and a customer-facing QBR deck
- **Pipeline:** Goal Extraction → Usage Analysis → Gap Detection → Opportunity Mapping →
  Narrative Generation (prompt chaining across structured inputs)

---

## 0. Prerequisites

| Need | Why |
|---|---|
| `ANTHROPIC_API_KEY` in `.env` | Calls Claude (Sonnet for extraction, Opus for narrative). Required for any **live** run. |
| Postgres running | Only for the **authenticated app** (`/`). The standalone `/workbench` needs no DB. |
| `npm install` | Dependencies |

```bash
cp .env.example .env          # then set ANTHROPIC_API_KEY=sk-ant-...
docker compose up -d postgres # only for the authenticated app
npm run dev                   # http://localhost:3000
```

There are **two ways to use the agent**. Pick based on what you want to show:

| Path | URL | Auth? | DB? | Best for |
|---|---|---|---|---|
| **A. Workbench** (single-page demo) | `/workbench` | No | No | Fastest demo of the 5-stage pipeline + brief + deck |
| **B. Authenticated app** (portfolio) | `/` | Yes | Yes | The full AM experience: accounts, saved runs, opportunities pipeline, integrations |

---

## 1. Path A — Workbench (fastest demo)

Open **`http://localhost:3000/workbench`**. No login required.

### What to provide

The workbench has an **Input workspace** tab with two cards:

**Card 1 — Dataset-backed account selection**
- **Transcript account** (required): pick one of the bundled case-study accounts:
  - `Meridian Furniture` (10 transcripts)
  - `Northfield Electrical` (8 transcripts)
  - `Apex` (1 transcript)
- **Optional usage row**: attach one anonymized usage row (`Mr Sparky` / `Auscraft
  Furniture`). Leave as **No usage row** for a transcript-only run.
  > ⚠️ The dataset's usage names do **not** match the transcript names — there is no safe
  > join key, so you select them independently. This is intentional and called out in the UI.
- **Selected transcript preview**: read-only view of what will be sent.

**Card 2 — Optional manual additions** (all optional, appended to the dataset inputs)
- **Additional call transcripts**: paste text, or upload `.txt`/`.vtt`/`.md` files
- **Optional email threads**: paste text, or upload `.txt`/`.eml`/`.md` files
- **Optional usage JSON / CSV**: paste a JSON object/array or a CSV header+row, or upload
  `.json`/`.csv`/`.txt`

**Minimum to run:** at least one transcript (selected account, pasted text, or uploaded
file). Usage and email are optional — transcript-only runs are valid.

### What to expect

1. Click **Run QBR pipeline**. The **Stage progress** panel streams live (Server-Sent
   Events) through the five stages:

   | Stage | What it does | Maps to PDF |
   |---|---|---|
   | 1. Goal extraction | Pulls customer objectives from transcripts/emails, each with an exact evidence quote | "Extracts customer goals" |
   | 2. Usage analysis | Marks each goal `working` / `partial` / `lagging` against usage signals | "Compares goals vs. product usage" |
   | 3. Gap detection | Finds underused catalog features tied to goals, severity 1–5 | "Identifies adoption gaps (free value)" |
   | 4. Opportunity mapping | Maps scored upsells from gaps, constrained to the product catalog | "Surfaces upsell opportunities" |
   | 5. Narrative generation | Assembles the QBR brief + deck slides | "Generates a QBR-ready summary + deck" |

   Each stage shows attempts and token usage as it completes.

2. When stage 5 finishes, the **Results** tab unlocks with the brief (see §3 for the full
   anatomy).

3. Use the brief's **Download PPTX** / **Download PDF** buttons for the customer-facing
   deck, and the **Push to CRM (mock)** / **Slack (mock)** buttons for the integrations.

---

## 2. Path B — Authenticated app (full AM experience)

Open **`http://localhost:3000`** and sign in. Seeded demo users (after `npm run seed`):

| Email | Password | Role |
|---|---|---|
| `admin@demo` | `demo1234` | admin |
| `lead@demo` | `demo1234` | cs_lead |
| `am@demo` | `demo1234` | am |

> If you cleaned the DB to test from scratch, the users + workspace remain but there are no
> accounts yet — start at "Create account" below.

### The screens

| Route | Purpose |
|---|---|
| `/` (Home) | Portfolio overview — your accounts and their health |
| `/portfolio` | All accounts in the workspace |
| `/accounts/[id]` | One account: contacts, sources, QBR runs, opportunities, action items |
| `/accounts/[id]/qbr/new` | Run wizard — kicks off a new QBR for that account |
| `/accounts/[id]/qbr/[runId]` | A saved brief (persisted, editable, approvable, exportable) |
| `/opportunities` | Cross-account expansion pipeline (Kanban-style stages) |

### Flow

1. **Create an account** (name, vertical, tier, ARR, renewal date).
2. **Add sources** to the account: upload/paste call transcripts, email threads, and a
   usage snapshot (`POST /api/accounts/[id]/sources`).
3. **Run a QBR** from `/accounts/[id]/qbr/new`. Same 5-stage streaming pipeline as the
   workbench, but the result is **persisted** as a `QbrRun` + `Brief`
   (`POST /api/accounts/[id]/run`).
4. **Review the brief** at `/accounts/[id]/qbr/[runId]`:
   - Edit the summary, top gaps/opportunities, and QBR outline inline
   - **Save** (`edited` flag) and **Approve** (timestamps `approvedAt`)
   - **Export** PPTX/PDF
   - **Push to CRM / Slack** (mock)
5. **Track opportunities** at `/opportunities` — move expansion opportunities through
   stages (identified → qualified → proposed → won/lost).

---

## 3. Anatomy of the brief (what "good" looks like)

Every run produces a structured brief. Here is what each part means and how it satisfies
the case study + the trust features.

### Header signals
- **overall confidence X%** — model's self-assessed confidence in the brief
- **evidence grounded X% (n/m)** — *the quote-grounding verifier*: the share of evidence
  quotes that were re-checked and confirmed to actually appear in their cited source.
  **100% is the target.** A lower number means some quote could not be matched back to a
  source (a hallucination signal) — investigate before trusting the brief.
- **~N min saved vs 45-min manual prep** — the case study's headline metric ("Save AMs
  30–60 min per account"), computed from actual pipeline runtime.
- **total tokens** and **estimated cost** — run economics.

### Body (maps to PDF "Example Output" + "Outputs")
| Section | Contents | PDF requirement |
|---|---|---|
| **Summary** | Executive narrative, editable | "Account summary (goals, status)" |
| **Customer Goals** | Each goal with description, evidence quote, confidence | "Customer Goals" |
| **Current Performance** | Per-goal `working`/`partial`/`lagging` status + metrics | "What's Working" |
| **Top Adoption Gaps** | Up to 3, **ranked by severity (high→low)**, with reason + severity/5 | "Top 3 adoption gaps" |
| **Expansion Opportunities** | Up to 3, **ranked by score (high→low)**, with pitch + expected impact | "Top 3 upsell opportunities" |
| **QBR Outline** | Goals · Current performance · Gaps · Opportunities · Asks | "Simple QBR outline" |
| **Deck slides** | The customer-facing deck content (exported to PPTX) | "Short customer-facing QBR deck" |

> **Ranking note:** the top-3 gaps/opportunities are re-ordered **deterministically in
> code** by severity/score — so the scoring drives selection, not just the model's free
> choice.

### Inline citations
Every goal, gap, and opportunity carries an **evidence quote** with its source label. Click
to expand and see the exact snippet. Claims without evidence are dropped, not guessed.

---

## 4. Headless validation (no UI)

Prove the whole thing from the command line:

```bash
npm run lint          # eslint, zero warnings
npx tsc --noEmit      # type safety
npm test              # unit tests (grounding verifier, ranking, schemas, pipeline glue)
npm run eval          # full 5-stage pipeline over all 3 real accounts, MOCK mode (no API key)
npm run eval -- --live   # same, but against real Claude (needs ANTHROPIC_API_KEY)
npm run build         # production build
```

`npm run eval` prints a per-account table (pass/fail, goal/gap/opportunity counts,
confidence) and asserts structural + **grounding** invariants. Expect `3/3 accounts passed`.

---

## 5. Feature checklist (case study PDF → where to see it)

| PDF item | Where to verify |
|---|---|
| Extract customer goals from calls/emails | Stage 1 → **Customer Goals** section with quotes |
| Compare goals vs. product usage | Stage 2 → **Current Performance** (working/partial/lagging) |
| Identify adoption gaps ("free value") | Stage 3 → **Top Adoption Gaps** with severity |
| Surface upsell opportunities | Stage 4 → **Expansion Opportunities** with score |
| QBR-ready summary | **Summary** + **QBR Outline** |
| Short customer-facing QBR deck | **Download PPTX** |
| Prompt chaining across structured inputs | Each stage consumes prior stages' typed output |
| Reduce hallucinations | Evidence-required schemas + **evidence grounded %** badge + catalog enum |
| Add scoring | Confidence (all stages) + severity (gaps) + score (opportunities) |
| Personalization | Vertical-tuned product playbooks (Home Services / Retail) |
| Integrations (CRM, Slack) | **Push to CRM / Slack** buttons (mock adapters) |
| Time saved per QBR (success metric) | **~N min saved** badge on the brief |

---

## 6. Notes & limits

- **Integrations are mock adapters.** CRM and Slack write to in-memory mocks and return a
  fake URL/timestamp. Setting a real Salesforce/HubSpot/Slack token throws by design — no
  live external calls are made.
- **No email in the bundled dataset.** The case-study data ships transcripts + usage only;
  email input is supported but optional. Paste your own to exercise it.
- **Product catalog is fixed:** Reviews, Webchat, Messaging, Payments, Phones, AI. Upsells
  are constrained to these — the agent will not invent features.
- **Determinism:** the pipeline runs at `temperature: 0` with schema-validated retries, so
  runs are stable but not byte-identical across model versions.
