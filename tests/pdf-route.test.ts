import { describe, expect, it, vi } from "vitest";

vi.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  renderToBuffer: vi.fn(async () => Buffer.from("%PDF-1.4 mock")),
}));

import { POST } from "@/app/api/export/pdf/route";

describe("pdf export route", () => {
  it("returns a PDF buffer for a valid brief payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/export/pdf", {
        method: "POST",
        body: JSON.stringify({
          brief: {
            accountName: "Northfield Electrical",
            summary:
              "After-hours demand is leaking, with AI as the clearest expansion path.",
            topGaps: ["gap-1"],
            topOpportunities: ["opp-1"],
            qbrOutline: {
              goals: ["Reduce missed calls"],
              currentPerformance: ["Missed calls remain elevated."],
              gaps: ["AI coverage is underused after hours."],
              opportunities: ["Expand AI coverage for inbound qualification."],
              asks: ["Approve AI expansion plan."],
            },
            deckSlides: [
              { title: "Executive summary", bullets: ["After-hours demand is leaking."] },
              { title: "Gap", bullets: ["AI coverage is underused."] },
              { title: "Ask", bullets: ["Approve expansion."] },
            ],
            overallConfidence: 0.82,
          },
          goals: [
            {
              id: "goal-1",
              title: "Reduce missed calls",
              description: "Customer wants after-hours coverage.",
              evidence: [
                {
                  sourceId: "call-1",
                  sourceType: "call",
                  quote: "We miss calls after hours.",
                },
              ],
              confidence: 0.9,
            },
          ],
          usage: [
            {
              goalId: "goal-1",
              status: "lagging",
              metrics: [{ label: "Missed calls L30", value: "12" }],
              notes: "Missed-call volume is still material.",
              evidence: [
                {
                  sourceId: "usage-1",
                  sourceType: "usage",
                  quote: "MISSED CALLS L30: 12.0",
                },
              ],
              confidence: 0.83,
            },
          ],
          gaps: [
            {
              id: "gap-1",
              goalId: "goal-1",
              feature: "AI",
              reason: "AI is not covering enough inbound demand after hours.",
              severity: 4,
              evidence: [
                {
                  sourceId: "call-1",
                  sourceType: "call",
                  quote: "We miss calls after hours.",
                },
              ],
              confidence: 0.81,
            },
          ],
          opportunities: [
            {
              id: "opp-1",
              gapId: "gap-1",
              feature: "AI",
              title: "Expansion opportunity",
              pitch: "Expand AI coverage for after-hours inquiries.",
              expectedImpact: "Recover more inbound leads without adding headcount.",
              score: 0.92,
              confidence: 0.84,
              evidence: [
                {
                  sourceId: "call-1",
                  sourceType: "call",
                  quote: "We miss calls after hours.",
                },
              ],
            },
          ],
          editedBrief: {
            summary: "Edited summary for export",
            topGaps: [
              {
                id: "gap-1",
                title: "AI adoption gap",
                description: "After-hours AI coverage is underused.",
              },
            ],
            topOpportunities: [
              {
                id: "opp-1",
                title: "Expand AI coverage",
                description: "Recover more inbound leads without adding headcount.",
              },
            ],
            qbrOutline: {
              goals: ["Reduce missed calls"],
              currentPerformance: ["Missed calls remain elevated."],
              gaps: ["AI coverage is underused after hours."],
              opportunities: ["Expand AI coverage for inbound qualification."],
              asks: ["Approve AI expansion plan."],
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(".pdf");
    expect(buffer.equals(Buffer.from("%PDF-1.4 mock"))).toBe(true);
  });
});
