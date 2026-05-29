# Dataset — AI GTM Engineer Case Study (Podium)

Real sample data shipped with the case study. This is the **primary** input set for the
QBR Agent (the `samples/acme-dental.md` file is a small synthetic fixture kept for unit tests).

## Layout

```
data/
  usage/
    customer-data-extract.xlsx   # original 103-col usage extract (source of truth)
    customer-data-extract.csv    # flattened export (app-consumable, no xlsx parser needed)
    customer-data-extract.json   # same, as array of row objects keyed by column header
  transcripts/
    meridian-furniture/          # 10 call transcripts (.txt, timestamped speaker turns)
    northfield-electrical/       # 8 call transcripts
    apex/                        # 1 intro call
  samples/
    acme-dental.md               # synthetic fixture for tests/demo
```

> No email threads were provided in this dataset — the email input remains optional in the
> pipeline; account briefs are built from transcripts + usage data.

## Usage extract (customer-data-extract.*)

- **Grain:** one row per location. 2 accounts present: **Mr Sparky** (Home Services /
  Electrical, HVAC) and **Auscraft Furniture** (Retail / Furniture).
- **103 columns** spanning every Podium product surface. Key columns the pipeline uses:

| Goal area | Columns |
|---|---|
| Reviews | `REVIEW INVITES LAST 30DAYS`, `ALL TIME REVIEW INVITES`, `LIFETIME ATTRIBUTED REVIEWS`, `LIFETIME TOTAL REVIEWS`, `LIFETIME AVERAGE TOTAL RATING` |
| Webchat / leads | `WEBCHAT LEADS RECEIVED LAST 30DAYS`, `TOTAL LEADS RECEIVED` |
| Messaging | `RECEIVED MESSAGES LAST 30DAYS`, `SENT MESSAGES LAST 30DAYS`, `TOTAL CFL CONVERSATION ITEMS` |
| AI | `Location AI Subscriptio Status`, `AI PRODUCT NAMES`, `AI Conversations L28 Days`, `AI Leads Qualified L28 Days`, `HAS AI LEAD SYNC INTEGRATION`, `LEAD SYNC SET UP STATUS` |
| Phones / calls | `PHONES PRODUCT STATUS`, `MISSED CALLS L30`, `LIFETIME CALLS`, `LIFETIME INBOUND/OUTBOUND CALLS` |
| Campaigns | `CAMPAIGN MESSAGES SENT/RESPONSES LAST 30/60 DAYS`, `CURRENT TOTAL OPT INS`, `LOCATION CAMPAIGNS SUBSCRIBER LIMIT` |
| Payments | `PROCESSED AMOUNT LAST 30/90 DAYS`, `INVOICES SENT ALL TIME`, `PAYMENTS PROCESSED ALL TIME`, `LOCATION HAS ACTIVE READERS` |
| Account / revenue | `ACCOUNT MANAGER`, `ORGANIZATION VERTICAL`, `BUNDLE_DISPLAY_NAME`, `CURRENT DATE ORG MRR USD`, `LOCATION CURRENT MONTH END ARR USD`, `AI OS MRR` |
| Integrations | `LOCATION HAS INTEGRATION CONNECTED`, `INTEGRATION NAMES`, `LOCATION IS ICP` |

Full column list: header row of the CSV.

## Transcripts

- Plain `.txt`, header block (title, CSM, recording metadata, participants) then a
  `Transcript` section of `M:SS | <Speaker>` turns. Speakers anonymized as
  "Customer Success Manager" / "Customer".
- Volume per account: Meridian Furniture (10 calls: onboarding, account reviews, AI setup,
  phones), Northfield Electrical (8: sales intro/follow-ups, podium overview, phone routing,
  AI setup/upgrade reviews), Apex (1 intro).

## ⚠️ Name mismatch (important for the pipeline)

The **usage extract** names (Mr Sparky, Auscraft Furniture) do **not** match the
**transcript** account names (Meridian Furniture, Northfield Electrical, Apex). They appear
to be independently anonymized — there is **no reliable join key** between the two files.

Implication: do not auto-join usage rows to transcripts by name. For the demo, treat each
account's transcripts + a chosen usage row as one "account" the AM selects, or run the
pipeline on transcripts alone (usage optional, per PIPELINE_SPEC). Surface this in the UI as
an account picker rather than assuming a merge.
