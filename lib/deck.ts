import PptxGenJS from "pptxgenjs";

import { Brief, Gap, Goal, Opportunity, UsageItem } from "@/lib/schemas";

interface DeckPayload {
  brief: Brief;
  goals: Goal[];
  usage: UsageItem[];
  gaps: Gap[];
  opportunities: Opportunity[];
}

function addTitleSlide(pptx: PptxGenJS, brief: Brief) {
  const slide = pptx.addSlide();
  slide.background = { color: "F7F1E7" };
  slide.addText(brief.accountName, {
    x: 0.6,
    y: 0.7,
    w: 8.5,
    h: 0.8,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: "0F766E",
  });
  slide.addText("QBR-ready account brief", {
    x: 0.6,
    y: 1.45,
    w: 4,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 12,
    color: "475569",
  });
  slide.addText(brief.summary, {
    x: 0.6,
    y: 2,
    w: 11.4,
    h: 1.3,
    fontFace: "Aptos",
    fontSize: 18,
    color: "1E293B",
    margin: 0.08,
    fit: "shrink",
  });
}

function addBulletSlide(
  pptx: PptxGenJS,
  title: string,
  bullets: string[],
  accent = "0F766E",
) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText(title, {
    x: 0.6,
    y: 0.6,
    w: 11,
    h: 0.5,
    fontFace: "Aptos Display",
    fontSize: 22,
    bold: true,
    color: accent,
  });
  slide.addText(
    bullets.map((bullet) => ({ text: bullet, options: { bullet: { indent: 18 } } })),
    {
      x: 0.85,
      y: 1.4,
      w: 10.6,
      h: 4.8,
      fontFace: "Aptos",
      fontSize: 18,
      color: "1F2937",
      breakLine: true,
      paraSpaceAfter: 14,
    },
  );
}

export async function buildBriefDeck(payload: DeckPayload) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "QBR Agent";
  pptx.company = "BESWAS";
  pptx.subject = `QBR brief for ${payload.brief.accountName}`;
  pptx.title = `${payload.brief.accountName} QBR Brief`;
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  addTitleSlide(pptx, payload.brief);

  const topGoals = payload.goals.slice(0, 3).map((goal) => `${goal.title}: ${goal.description}`);
  addBulletSlide(pptx, "Customer Goals", topGoals.length ? topGoals : ["No grounded goals identified."]);

  const performanceBullets = payload.usage.slice(0, 4).map((item) => {
    const metrics = item.metrics.map((metric) => `${metric.label} ${metric.value}`).join(" · ");
    return `${item.goalId} (${item.status}): ${item.notes}${metrics ? ` — ${metrics}` : ""}`;
  });
  addBulletSlide(
    pptx,
    "Current Performance",
    performanceBullets.length ? performanceBullets : ["No grounded usage observations available."],
    "C2410C",
  );

  const topGapBullets = payload.brief.topGaps.map((gapId) => {
    const gap = payload.gaps.find((item) => item.id === gapId);
    return gap
      ? `${gap.feature}: ${gap.reason} (severity ${gap.severity}/5)`
      : gapId;
  });
  addBulletSlide(
    pptx,
    "Top Adoption Gaps",
    topGapBullets.length ? topGapBullets : ["No grounded adoption gaps identified."],
    "B45309",
  );

  const topOpportunityBullets = payload.brief.topOpportunities.map((opportunityId) => {
    const opportunity = payload.opportunities.find((item) => item.id === opportunityId);
    return opportunity
      ? `${opportunity.feature}: ${opportunity.pitch} (score ${opportunity.score.toFixed(2)})`
      : opportunityId;
  });
  addBulletSlide(
    pptx,
    "Expansion Opportunities",
    topOpportunityBullets.length
      ? topOpportunityBullets
      : ["No grounded expansion opportunities identified."],
  );

  payload.brief.deckSlides.forEach((slide) =>
    addBulletSlide(pptx, slide.title, slide.bullets, "1D4ED8"),
  );

  const arrayBuffer = (await pptx.write({
    outputType: "arraybuffer",
  })) as ArrayBuffer;
  return Buffer.from(new Uint8Array(arrayBuffer));
}
