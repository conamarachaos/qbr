# PRD — AI Account Review & Expansion Agent ("QBR Agent")

> Case study: Podium — AI GTM Engineer. Turn fragmented customer signals (calls,
> emails, usage) into a clear, actionable account narrative that replaces manual QBR prep.

## 1. Problem

Account Managers (AMs) spend 30–60 min/account manually preparing Quarterly Business
Reviews (QBRs) by reviewing call transcripts, email threads, and usage dashboards.
Result: inconsistent insights, missed upsell opportunities, weak alignment between
customer goals and product usage.

## 2. Opportunity

Unify fragmented customer data into a clear, actionable account narrative — automatically.

## 3. Goal & Success Definition

Save AMs 30–60 minutes per account and improve QBR quality and consistency.

### Success Metrics

| Type | Metric | Target (MVP) |
|---|---|---|
| Leading | Time saved per QBR | ≥ 30 min |
| Leading | % accounts with ≥1 identified gap | ≥ 80% |
| Leading | AM adoption (briefs generated / AM / week) | trackable |
| Leading | % outputs accepted without major edit | ≥ 60% |
| Lagging | Expansion revenue influenced | tracked downstream |
| Lagging | Feature adoption lift | tracked downstream |
| Lagging | Retention (NRR) | tracked downstream |

## 4. Users

- **Primary:** Account Managers preparing QBRs.
- **Secondary:** CS leadership reviewing pipeline of expansion opportunities.

## 5. Scope

### In (MVP)

**Inputs**
- Call transcripts (paste / upload .txt / .vtt)
- Email threads (paste / upload .txt / .eml)
- Basic usage data (CSV / JSON: feature → usage metric)

**Pipeline (prompt chaining)**
1. **Goal Extraction** — customer objectives from transcripts/emails (with evidence spans)
2. **Usage Analysis** — actual usage vs. expected behavior per goal
3. **Gap Detection** — underused features tied to goals ("free value")
4. **Opportunity Mapping** — upsell/expansion suggestions from gaps + signals
5. **Narrative Generation** — QBR-ready brief + short customer-facing deck

**Outputs**
- Account summary (goals + status)
- Top 3 adoption gaps
- Top 3 upsell opportunities
- Simple QBR outline (Goals → Performance → Gaps → Opportunities → Asks)
- Downloadable QBR deck (PPTX) + brief (Markdown/PDF)
- Every claim carries an **evidence citation** + **confidence score**

### Out (not yet)

- CRM integrations (Salesforce/HubSpot)
- Real-time data sync
- Advanced analytics / forecasting
- Slack delivery (stretch, Day 5)

## 6. Functional Requirements

- FR1: Upload/paste calls, emails, usage; persist per account.
- FR2: Run the 5-stage pipeline; each stage emits validated structured JSON.
- FR3: Every extracted goal/gap/opportunity links to ≥1 source evidence span.
- FR4: Each claim has a confidence score (0–1); low-confidence flagged in UI.
- FR5: Render an editable account brief; AM can edit before export.
- FR6: Export QBR deck as PPTX and brief as Markdown/PDF.
- FR7: Streaming UI — show pipeline stages progressing live.
- FR8: Ship with sample account data (Podium-style: Reviews, Webchat, Messaging).

## 7. Non-Functional Requirements

- Grounding-first: no claim without evidence → reduces hallucination.
- Deterministic schema: all LLM outputs validated with Zod; auto-retry on mismatch.
- Latency: full pipeline < 60s for a typical account on a fast model.
- Cost: per-account run cost tracked and shown.
- Privacy: customer data stays in the user's deployment; no third-party storage in MVP.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Noisy/incomplete data | Pre-clean + chunk; stage tolerates missing inputs, flags gaps in coverage |
| Incorrect goal inference | Evidence-span citation required; AM review step; confidence scoring |
| Low trust in AI outputs | Show sources inline, editable brief, confidence badges, "why" rationale |
| Hallucinated upsells | Opportunity must map to a detected gap + a real product feature (allowlist) |
| Schema drift / malformed JSON | `generateObject` + Zod validation + bounded retries |

## 9. 5-Day Iteration Plan

- **Day 1–2:** MVP pipeline + static prompts. Next.js app, upload/paste UI, 5-stage
  chain with Zod schemas, sample data, basic brief render.
- **Day 3–4:** Improve reasoning, reduce hallucinations (evidence spans, citations),
  add confidence scoring, gap/opportunity ranking, PPTX/PDF export.
- **Day 5:** Personalization (per-product playbooks) + integration stubs (CRM/Slack),
  polish, evals on sample accounts.

## 10. Example Output (target)

```
Customer Goals:        Increase Google reviews · Improve lead response speed
What's Working:        Messaging usage is high
Adoption Gaps:         Reviews feature underused · Webchat not enabled
Upsell Opportunities:  Enable Webchat (aligns w/ lead-response goal) · Reviews expansion
QBR Outline:           Goals → Current performance → Gaps → Opportunities → Asks
```
