import { IntegrationBriefPayload } from "@/lib/integrations/shared";

export interface SlackNotifier {
  postBriefSummary(
    brief: IntegrationBriefPayload,
    channel?: string,
  ): Promise<{ ok: boolean; ts: string; preview: string; channel: string }>;
}

function truncate(value: string, max = 180) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 3).trimEnd()}...`;
}

export function formatSlackBriefSummary(
  brief: IntegrationBriefPayload,
  channel = "#qbr-agent-mock",
) {
  const topGoal = brief.qbrOutline.goals[0] || "No primary goal captured";
  const topGap = brief.topGaps[0]?.title || "No primary gap captured";
  const topOpportunity =
    brief.topOpportunities[0]?.title || "No primary opportunity captured";

  return [
    `${channel} :: *QBR Brief* for *${brief.accountName}*`,
    `- Top goal: ${topGoal}`,
    `- Top gap: ${topGap}`,
    `- Top opportunity: ${topOpportunity}`,
    `- Overall confidence: ${Math.round(brief.overallConfidence * 100)}%`,
    `- Summary: ${truncate(brief.summary)}`,
  ].join("\n");
}

export class MockSlackNotifier implements SlackNotifier {
  async postBriefSummary(
    brief: IntegrationBriefPayload,
    channel = "#qbr-agent-mock",
  ): Promise<{ ok: boolean; ts: string; preview: string; channel: string }> {
    const preview = formatSlackBriefSummary(brief, channel);
    const ts = `${Date.now()}.${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    console.info("[mock-slack] postBriefSummary", {
      accountName: brief.accountName,
      channel,
    });

    return {
      ok: true,
      ts,
      preview,
      channel,
    };
  }
}

export function getSlackNotifier(): SlackNotifier {
  const provider = process.env.SLACK_PROVIDER?.toLowerCase();

  if (
    provider === "slack" ||
    process.env.SLACK_BOT_TOKEN ||
    process.env.SLACK_WEBHOOK_URL
  ) {
    throw new Error("slack notifier not implemented");
  }

  return new MockSlackNotifier();
}
