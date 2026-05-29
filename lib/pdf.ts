import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import {
  applyEditedBrief,
  buildOutlineWithConfidence,
  resolveTopGapExports,
  resolveTopOpportunityExports,
  type ExportPayload,
} from "@/lib/brief-export";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#F8F4EC",
    color: "#1F2937",
    fontSize: 11,
    lineHeight: 1.45,
    padding: 32,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: "#0F766E",
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
  },
  subtitle: {
    color: "#64748B",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  summary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    color: "#0F766E",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 700,
    width: "76%",
  },
  meta: {
    color: "#64748B",
    fontSize: 9,
    marginTop: 4,
  },
  confidence: {
    color: "#0F766E",
    fontSize: 9,
    fontWeight: 700,
  },
  outlineRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  outlineLabel: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  outlineItem: {
    marginBottom: 5,
  },
  outlineText: {
    fontSize: 10,
  },
  outlineConfidence: {
    color: "#64748B",
    fontSize: 8,
    marginTop: 2,
  },
});

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}% confidence`;
}

function textNode(
  content: string,
  style?: (typeof styles)[keyof typeof styles],
  key?: string,
) {
  return React.createElement(Text, { key, style }, content);
}

function viewNode(
  children: React.ReactNode[],
  style?: (typeof styles)[keyof typeof styles],
  key?: string,
) {
  return React.createElement(View, { key, style }, ...children);
}

function BriefPdfDocument(payload: ExportPayload) {
  const brief = applyEditedBrief(payload.brief, payload.editedBrief);
  const topGaps = resolveTopGapExports(payload.brief, payload.gaps, payload.editedBrief);
  const topOpportunities = resolveTopOpportunityExports(
    payload.brief,
    payload.opportunities,
    payload.editedBrief,
  );
  const outline = buildOutlineWithConfidence(
    payload.brief,
    payload.goals,
    payload.usage,
    payload.gaps,
    payload.opportunities,
    payload.editedBrief,
  );

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: styles.page },
      viewNode(
        [
          textNode(brief.accountName, styles.title, "title"),
          textNode("QBR-ready account brief", styles.subtitle, "subtitle"),
          viewNode([textNode(brief.summary, undefined, "summary-text")], styles.summary, "summary"),
        ],
        styles.header,
        "header",
      ),
      viewNode(
        [
          textNode("Top 3 Gaps", styles.sectionTitle, "top-gaps-title"),
          ...topGaps.map((gap) =>
            viewNode(
              [
                viewNode(
                  [
                    textNode(gap.title, styles.cardTitle, `${gap.id}-title`),
                    textNode(
                      formatConfidence(gap.confidence),
                      styles.confidence,
                      `${gap.id}-confidence`,
                    ),
                  ],
                  styles.cardTitleRow,
                  `${gap.id}-row`,
                ),
                textNode(gap.description, undefined, `${gap.id}-description`),
                textNode(
                  `${gap.feature ? `${gap.feature} · ` : ""}${
                    typeof gap.severity === "number" ? `severity ${gap.severity}/5` : ""
                  }`,
                  styles.meta,
                  `${gap.id}-meta`,
                ),
              ],
              styles.card,
              gap.id,
            ),
          ),
        ],
        styles.section,
        "top-gaps",
      ),
      viewNode(
        [
          textNode("Top 3 Opportunities", styles.sectionTitle, "top-opps-title"),
          ...topOpportunities.map((opportunity) =>
            viewNode(
              [
                viewNode(
                  [
                    textNode(
                      opportunity.title,
                      styles.cardTitle,
                      `${opportunity.id}-title`,
                    ),
                    textNode(
                      formatConfidence(opportunity.confidence),
                      styles.confidence,
                      `${opportunity.id}-confidence`,
                    ),
                  ],
                  styles.cardTitleRow,
                  `${opportunity.id}-row`,
                ),
                textNode(
                  opportunity.description,
                  undefined,
                  `${opportunity.id}-description`,
                ),
                textNode(
                  `${opportunity.feature ? `${opportunity.feature} · ` : ""}${
                    typeof opportunity.score === "number"
                      ? `score ${opportunity.score.toFixed(2)}`
                      : ""
                  }`,
                  styles.meta,
                  `${opportunity.id}-meta`,
                ),
              ],
              styles.card,
              opportunity.id,
            ),
          ),
        ],
        styles.section,
        "top-opportunities",
      ),
      viewNode(
        [
          textNode("QBR Outline", styles.sectionTitle, "outline-title"),
          ...outline.map((section) =>
            viewNode(
              [
                textNode(section.title, styles.outlineLabel, `${section.title}-label`),
                ...section.items.map((item, index) =>
                  viewNode(
                    [
                      textNode(`\u2022 ${item.text}`, styles.outlineText, `${section.title}-${index}-text`),
                      textNode(
                        formatConfidence(item.confidence),
                        styles.outlineConfidence,
                        `${section.title}-${index}-confidence`,
                      ),
                    ],
                    styles.outlineItem,
                    `${section.title}-${index}`,
                  ),
                ),
              ],
              styles.outlineRow,
              section.title,
            ),
          ),
        ],
        styles.section,
        "outline",
      ),
    ),
  );
}

export async function buildBriefPdf(payload: ExportPayload) {
  return renderToBuffer(BriefPdfDocument(payload));
}
