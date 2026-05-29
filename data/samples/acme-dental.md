# Sample Account — Acme Dental (Podium-style)

Used to demo/test the pipeline end-to-end. Mirrors the case-study example output.

## Call Transcript — 2026-03-12 (QBR prep call)

AM: Thanks for hopping on. What's top of mind this quarter?
Customer: Two things. We really want to grow our Google reviews — we're at like 40 and our
competitor down the street has 300. And our front desk is slow to respond to new leads;
people message us and we don't get back for hours, sometimes a day.
AM: Got it. You're using Messaging a lot already, right?
Customer: Yeah, the team lives in Messaging, that part's great. We text patients constantly.
AM: And reviews — are you sending review invites after appointments?
Customer: Honestly, no. We meant to set that up but never did.
AM: Webchat on your website?
Customer: We don't have that turned on. Is that a thing?

## Email Thread — 2026-03-18

From: office@acmedental.com
Subject: Re: getting more reviews
We talked about reviews at our last visit. We'd love to get to 200+ this year. Whatever
helps automate asking patients would be huge. Also our website just sits there — if there's
a way to capture people who land on it we're interested.

## Usage Data (JSON)

```json
{
  "account": "Acme Dental",
  "period": "2026-Q1",
  "features": [
    { "feature": "Messaging", "monthlyActiveUse": 0.92, "trend": "up" },
    { "feature": "Reviews", "monthlyActiveUse": 0.05, "trend": "flat" },
    { "feature": "Webchat", "enabled": false, "monthlyActiveUse": 0.0 },
    { "feature": "Payments", "enabled": false, "monthlyActiveUse": 0.0 }
  ]
}
```

## Expected brief (sanity check)

- **Goals:** increase Google reviews; improve lead response speed
- **Working:** Messaging usage high (0.92)
- **Gaps:** Reviews underused (0.05) tied to reviews goal; Webchat not enabled tied to lead-response goal
- **Opportunities:** Enable Webchat (lead response); expand Reviews automation
