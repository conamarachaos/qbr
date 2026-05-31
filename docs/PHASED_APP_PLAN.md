# Phased Customer-Scoped App — Build Plan

> Upgrade the QBR Agent from a stateless single-page **developer workbench** into a
> full multi-user **product**: AMs log in, manage a portfolio of customer accounts,
> ingest signals per account, run the (existing) 5-stage AI pipeline, and get a
> persisted, reviewable, exportable QBR — with an opportunity pipeline and a mutual
> action plan that closes the loop into the next quarter.
>
> **Do NOT rewrite the pipeline.** `lib/pipeline/*`, `lib/schemas.ts`, `lib/catalog.ts`,
> `lib/models.ts`, `lib/ingest.ts`, `lib/deck.ts`, `lib/pdf.ts`, `lib/eval.ts` and the
> `prompts/*` are correct and reusable. This work wraps them in a product shell and
> persistence layer. The existing `/api/run` SSE pipeline and `/api/export/*` routes
> stay; we add account-scoped wrappers around them.

## Decisions (locked)

| Concern | Choice |
|---|---|
| Persistence | **Prisma + PostgreSQL** (own `pgvector/pgvector:pg16` container via docker-compose) |
| Auth | **Auth.js v5 (NextAuth) — Credentials** (email + password, bcrypt), **database session strategy** |
| Roles | `am`, `cs_lead`, `admin` (workspace-scoped RBAC) |
| Scope | **Full phased product** (portfolio → account 360 → ingestion → run → review → opportunities + MAP) |
| Multi-tenancy | single `Workspace` tenant spine; scope **every** query by `workspaceId` |

## Architecture changes

```
NEW product shell (this work)                EXISTING engine (reuse, do not rewrite)
┌─────────────────────────────────┐          ┌──────────────────────────────────────┐
│ Auth.js (credentials, DB session)│          │ lib/pipeline/* (5-stage chain)        │
│ Prisma + Postgres (entities)     │  ──────▶ │ lib/schemas.ts (Zod, invariants)      │
│ Portfolio / Account 360 / Run UI │  feeds   │ lib/catalog.ts (feature allowlist)    │
│ Signals ingestion + persistence  │  signals │ lib/deck.ts / lib/pdf.ts (exports)    │
│ QBR runs + briefs persisted      │  ◀────── │ /api/run SSE, /api/export/* routes    │
│ Opportunity pipeline + MAP       │  results │                                        │
└─────────────────────────────────┘          └──────────────────────────────────────┘
```

The existing `/api/run` already returns `{ goals, usage, gaps, opportunities, brief, stages, usageTotals }`.
The new account-scoped run route **persists** that result into `QbrRun` + `Brief` + seeds
`Opportunity` rows from `result.opportunities`, then streams the same SSE events to the UI.

## Data model (Prisma)

Tenancy spine: everything hangs off `Workspace`; scope every query by `workspaceId`.

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  members   Membership[]
  accounts  Account[]
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String                        // bcrypt; credentials provider
  createdAt    DateTime @default(now())
  memberships  Membership[]
  ownerships   AccountOwnership[]
  sessions     Session[]
  accounts     Account[]   @relation("createdAccounts")
}

model Membership {                            // user ↔ workspace ↔ role
  id          String   @id @default(cuid())
  userId      String
  workspaceId String
  role        Role     @default(am)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@unique([userId, workspaceId])
}

enum Role { am cs_lead admin }

model Account {                               // a CUSTOMER company (the thing AMs manage)
  id            String   @id @default(cuid())
  workspaceId   String
  name          String
  vertical      String?                       // "Home Services" | "Retail" (from catalog)
  tier          Tier     @default(growth)
  arr           Int?                           // annual recurring revenue (cents or whole; pick whole $)
  renewalDate   DateTime?
  lifecycle     Lifecycle @default(active)
  createdById   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy     User?     @relation("createdAccounts", fields: [createdById], references: [id])
  ownerships    AccountOwnership[]
  contacts      Contact[]
  sources       Source[]
  usageSnapshots UsageSnapshot[]
  healthScores  HealthScore[]
  qbrRuns       QbrRun[]
  opportunities Opportunity[]
  actionItems   ActionItem[]
  @@index([workspaceId])
}

enum Tier { strategic growth at_risk }
enum Lifecycle { onboarding active renewal churned }

model AccountOwnership {                       // book of business (M:N, NOT a single owner_id)
  id        String @id @default(cuid())
  accountId String
  userId    String
  role      OwnershipRole @default(primary_am)
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([accountId, userId])
  @@index([userId])
}

enum OwnershipRole { primary_am secondary exec_sponsor }

model Contact {                                // stakeholder mapping (champion went quiet = risk)
  id        String  @id @default(cuid())
  accountId String
  name      String
  title     String?
  roleType  ContactRole @default(user)
  email     String?
  lastEngagedAt DateTime?
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId])
}

enum ContactRole { champion economic_buyer user detractor }

model Source {                                 // a raw uploaded/pasted signal source
  id         String   @id @default(cuid())
  accountId  String
  type       SourceType                        // call | email | usage
  label      String
  content    String   @db.Text                 // raw text; usage stored as JSON-string
  uploadedById String?
  createdAt  DateTime @default(now())
  account    Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId])
}

enum SourceType { call email usage }

model UsageSnapshot {                           // time-series adoption (QBRs are about deltas)
  id        String   @id @default(cuid())
  accountId String
  period    String                              // e.g. "2026-Q1"
  data      Json                                // feature → metric map
  createdAt DateTime @default(now())
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId])
}

model HealthScore {                             // time-series; latest drives portfolio color
  id        String   @id @default(cuid())
  accountId String
  asOf      DateTime @default(now())
  overall   Int                                 // 0-100
  category  HealthCategory
  components Json                                // {usage, support, sentiment, engagement}
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId])
}

enum HealthCategory { healthy at_risk critical }

model QbrRun {                                   // one execution of the pipeline for an account
  id          String   @id @default(cuid())
  accountId   String
  triggeredById String?
  status      RunStatus @default(running)
  period      String?                            // "2026-Q1"
  modelMeta   Json?                              // { extractionModel, narrativeModel }
  usageTotals Json?                              // token totals
  stages      Json?                              // per-stage attempts/usage from pipeline
  goals       Json?                              // raw stage outputs persisted for the 360 view
  usage       Json?
  gaps        Json?
  opportunities Json?
  error       String?
  createdAt   DateTime @default(now())
  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  brief       Brief?
  @@index([accountId])
}

enum RunStatus { queued running ready failed }

model Brief {                                    // the editable QBR artifact (1:1 with run)
  id        String   @id @default(cuid())
  qbrRunId  String   @unique
  data      Json                                 // BriefSchema output (+ AM edits)
  edited    Boolean  @default(false)
  approvedAt DateTime?
  qbrRun    QbrRun   @relation(fields: [qbrRunId], references: [id], onDelete: Cascade)
}

model Opportunity {                              // expansion pipeline (seeded from run, AM-curated)
  id        String   @id @default(cuid())
  accountId String
  qbrRunId  String?
  feature   String                               // must be a PRODUCT_FEATURES value
  pitch     String   @db.Text
  expectedImpact String? @db.Text
  score     Float?
  type      OppType  @default(expansion)
  stage     OppStage @default(identified)
  amount    Int?
  createdAt DateTime @default(now())
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId])
}

enum OppType { renewal expansion upsell }
enum OppStage { identified qualified proposed won lost }

model ActionItem {                               // Mutual Action Plan; resurfaces next QBR
  id        String   @id @default(cuid())
  accountId String
  qbrRunId  String?
  title     String
  ownerId   String?
  dueDate   DateTime?
  status    ActionStatus @default(open)
  createdAt DateTime @default(now())
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId])
}

enum ActionStatus { open in_progress done }

// Auth.js v5 adapter models (Account-OAuth/Session/VerificationToken) — use the
// official Prisma adapter models, but RENAME the adapter "Account" model to
// "AuthAccount" (table "auth_accounts") to avoid colliding with our customer Account.
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
// (AuthAccount + VerificationToken per Auth.js Prisma adapter docs)
```

## Phased user journey (screens to build)

1. **Auth** — `/login` (credentials), `/register` (optional, or seed-only). Middleware
   protects everything except `/login`, `/register`, `/api/auth/*`. DB session strategy
   so role/ownership changes take effect without re-login.
2. **Portfolio / Book of business** — `/` (post-login home). Table of accounts the user
   owns (AM) or all accounts (cs_lead/admin): name, tier, ARR, renewal date, health
   badge, last QBR, "QBR due" flag. Filter by tier, sort by renewal proximity. "New
   account" action.
3. **Account 360** — `/accounts/[id]`. Header (name, ARR, renewal, owners, tier, health).
   Tabs: **Overview** (goals from latest run, health trend), **Signals** (sources list +
   add/upload), **Usage** (snapshots), **Opportunities**, **QBRs** (run history),
   **Action plan** (MAP). "Generate QBR" CTA.
4. **Signal ingestion** — per-account add/upload of call transcripts, emails, usage
   CSV/JSON → persisted as `Source` rows. Reuse the existing file-read + paste UX from
   `qbr-workbench.tsx`, but scope to the account and save to DB.
5. **Run QBR** — `/accounts/[id]/qbr/new` (or modal). Creates a `QbrRun`, calls the
   account-scoped run route which loads the account's `Source` rows, builds the
   `NormalizeAccountInputArgs`, streams the existing pipeline (same SSE events +
   `StageProgress` component), and on completion persists `QbrRun` + `Brief` + seeds
   `Opportunity` rows. 
6. **Review & edit** — `/accounts/[id]/qbr/[runId]`. Render the existing `BriefView`
   (cited claims, confidence badges) but backed by the persisted brief; AM edits inline
   (the `EditableBrief` flow already exists), saves to `Brief.data`, can mark approved,
   then export PPTX/PDF via the existing `/api/export/*` routes.
7. **Opportunities** — account tab + (optional) workspace-wide `/opportunities` pipeline
   board grouped by stage. Seeded from runs, AM moves through stages.
8. **Action plan (MAP)** — capture action items with owner + due date on a run; they
   show on the account and are meant to resurface at the next QBR.
9. **Grounded account Q&A (Ask tab)** — per-account chatbot on `/accounts/[id]`. Answers
   only from that account's `Source` chunks (pgvector retrieval over OpenAI
   `text-embedding-3-small` embeddings, indexed automatically on source-add and after each run) + the latest
   persisted brief. Every cited quote is re-verified by the existing `lib/grounding.ts`
   verifier and flagged in the UI if unverified; refuses when signals don't cover the
   question. Scoped by the same `buildAccountAccessWhere` rules; persists `ChatMessage`
   history. Strictly additive — does not touch `lib/pipeline/*`, `lib/schemas.ts`, or
   `prompts/*`. Falls back to a deterministic local embedding when `OPENAI_API_KEY` is unset.

## Implementation tasks (order)

1. **Deps + infra**: add `prisma`, `@prisma/client`, `next-auth@beta` (v5),
   `@auth/prisma-adapter`, `bcryptjs`, `@types/bcryptjs`. Add a `docker-compose.yml`
   with a `pgvector/pgvector:pg16` Postgres service (port 5433 to avoid clashing with
   the aidev platform's 5432). Update `.env.example` with `DATABASE_URL`,
   `AUTH_SECRET`, `AUTH_URL`.
2. **Prisma schema** (above) + initial migration. `lib/db.ts` singleton client.
3. **Auth**: `auth.ts` (Auth.js v5 config, credentials provider, Prisma adapter,
   database sessions, role+workspace in session callback), `middleware.ts` route guard,
   `app/api/auth/[...nextauth]/route.ts`, `/login` + `/register` pages, server helpers
   `getCurrentUser()` / `requireRole()`.
4. **Seed** (`prisma/seed.ts`): one workspace, 3 users (admin@demo / am@demo /
   lead@demo, password `demo1234`), and import the existing `data/transcripts/*` +
   `data/usage/*` as real customer Accounts with persisted `Source` rows and an initial
   `UsageSnapshot` / `HealthScore`, so the app is populated on first boot. Reuse
   `lib/dataset.ts` loaders.
5. **Data access layer** (`lib/repo/*` or server actions): all workspace-scoped CRUD for
   accounts, sources, runs, briefs, opportunities, action items. Enforce ownership/role.
6. **Account-scoped run route** (`app/api/accounts/[id]/run/route.ts`): load sources →
   `normalizeAccountInput` → `runPipeline` (reuse) → stream SSE → persist on completion.
   Keep the legacy `/api/run` working for the standalone workbench.
7. **UI**: app shell (sidebar nav + user menu + sign-out), portfolio table, account 360
   tabs, ingestion forms, run page (reuse `StageProgress`), review page (reuse
   `BriefView` + editable brief + export buttons), opportunities board, MAP.
8. **Keep exports working**: `/api/export/pptx` + `/api/export/pdf` already accept the
   brief payload — call them from the review page with the persisted/edited brief.
9. **Tests**: keep existing vitest suite green. Add tests for repo scoping (a user can't
   read another workspace's account) and the run-persist path (mock the pipeline).
10. **Polish**: empty/loading/error states, baseline-ui pass, README update with the
    docker-compose + `prisma migrate` + seed quickstart.

## Guardrails / invariants to preserve

- Every QBR claim stays **cited + confidence-scored** (already enforced in schemas).
- Opportunities must reference a real catalog feature + a backing gap (already enforced
  by `validateOpportunityInvariants`); persisted `Opportunity.feature` must be a
  `PRODUCT_FEATURES` value.
- **Workspace scoping on every query** — never trust a client-supplied workspaceId; derive
  from session. A user may only read/write accounts in their workspace; AMs are further
  limited to owned accounts for write actions (cs_lead/admin see all).
- **Human sign-off**: brief is editable and must be explicitly approvable before export.
- DB **session** strategy (not JWT) so ownership/role reassignment is immediate.

## Definition of done

- `docker compose up -d` + `npx prisma migrate deploy` + `npm run seed` + `npm run dev`
  → log in as `am@demo`, see a populated portfolio, open an account, run a QBR, watch
  stages stream, review the cited brief, edit + approve, export PPTX/PDF, see seeded
  opportunities + add an action item.
- Existing vitest suite passes; `npm run build` clean; lint clean.
- No regression to the standalone `/api/run` pipeline or `prompts/*` / `lib/pipeline/*`.
