import { Evidence, SourceTypeSchema } from "@/lib/schemas";

export type SourceType = (typeof SourceTypeSchema)["Enum"][keyof (typeof SourceTypeSchema)["Enum"]];

export interface RawSourceInput {
  id?: string;
  label?: string;
  type: SourceType;
  content: string;
}

export interface UsageSummary {
  sourceId: string;
  sourceType: "usage";
  accountName: string;
  accountManager?: string;
  vertical?: string;
  arrUsd?: number | null;
  mrrUsd?: number | null;
  reviews: {
    invitesLast30Days?: number | null;
    allTimeInvites?: number | null;
    lifetimeAttributedReviews?: number | null;
    lifetimeTotalReviews?: number | null;
    averageTotalRating?: number | null;
  };
  webchat: {
    leadsLast30Days?: number | null;
    totalLeads?: number | null;
  };
  messaging: {
    receivedLast30Days?: number | null;
    sentLast30Days?: number | null;
    totalConversationItems?: number | null;
  };
  ai: {
    status?: string;
    products: string[];
    conversationsLast28Days?: number | null;
    leadsQualifiedLast28Days?: number | null;
  };
  phones: {
    status?: string;
    missedCallsLast30Days?: number | null;
    lifetimeCalls?: number | null;
  };
  payments: {
    processedAmountLast30Days?: number | null;
    processedAmountLast90Days?: number | null;
  };
  integrations: string[];
  raw: Record<string, unknown>;
}

export interface NormalizedSource {
  id: string;
  type: SourceType;
  label: string;
  content: string;
}

export interface NormalizedAccountInput {
  accountName: string;
  transcripts: NormalizedSource[];
  emails: NormalizedSource[];
  usage?: UsageSummary;
  sourceMap: Record<string, NormalizedSource>;
  transcriptContext: string;
  emailContext: string;
  usageContext: string;
  combinedContext: string;
}

export interface NormalizeAccountInputArgs {
  accountName: string;
  transcripts?: RawSourceInput[];
  emails?: RawSourceInput[];
  usageRow?: Record<string, unknown> | null;
  usageText?: string;
}

const USAGE_COLUMN_MAP = {
  organizationName: "ORGANIZATION NAME",
  reviewInvitesLast30Days: "REVIEW INVITES LAST 30DAYS",
  allTimeReviewInvites: "ALL TIME REVIEW INVITES",
  lifetimeAttributedReviews: "LIFETIME ATTRIBUTED REVIEWS",
  lifetimeTotalReviews: "LIFETIME TOTAL REVIEWS",
  lifetimeAverageTotalRating: "LIFETIME AVERAGE TOTAL RATING",
  webchatLeadsLast30Days: "WEBCHAT LEADS RECEIVED LAST 30DAYS",
  totalLeadsReceived: "TOTAL LEADS RECEIVED",
  receivedMessagesLast30Days: "RECEIVED MESSAGES LAST 30DAYS",
  sentMessagesLast30Days: "SENT MESSAGES LAST 30DAYS",
  totalConversationItems: "TOTAL CFL CONVERSATION ITEMS",
  aiStatus: "Location AI Subscriptio Status",
  aiProductNames: "AI PRODUCT NAMES",
  aiConversationsLast28Days: "AI Conversations L28 Days",
  aiLeadsQualifiedLast28Days: "AI Leads Qualified L28 Days",
  missedCallsLast30Days: "MISSED CALLS L30",
  phonesProductStatus: "PHONES PRODUCT STATUS",
  processedAmountLast30Days: "PROCESSED AMOUNT LAST 30 DAYS",
  processedAmountLast90Days: "PROCESSED AMOUNT LAST 90 DAYS",
  integrationNames: "INTEGRATION NAMES",
  organizationVertical: "ORGANIZATION VERTICAL",
  accountManager: "ACCOUNT MANAGER",
  currentMrrUsd: "CURRENT DATE ORG MRR USD",
  currentArrUsd: "LOCATION CURRENT MONTH END ARR USD",
} as const;

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function parseJsonList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function makeSourceId(type: SourceType, index: number) {
  return `${type}-${index + 1}`;
}

function normalizeSources(type: SourceType, inputs: RawSourceInput[] = []) {
  return inputs
    .filter((input) => input.content.trim())
    .map<NormalizedSource>((input, index) => ({
      id: input.id || makeSourceId(type, index),
      type,
      label: input.label || `${type.toUpperCase()} ${index + 1}`,
      content: input.content.trim(),
    }));
}

function buildContext(sources: NormalizedSource[]) {
  return sources
    .map(
      (source) =>
        `SOURCE ${source.id} (${source.type}) — ${source.label}\n${source.content}`,
    )
    .join("\n\n---\n\n");
}

function parseUsageText(usageText?: string) {
  if (!usageText?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(usageText);
    if (Array.isArray(parsed)) {
      return (parsed[0] ?? null) as Record<string, unknown> | null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    const [headerRow, valueRow] = usageText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!headerRow || !valueRow) {
      return null;
    }

    const headers = headerRow.split(",").map((item) => item.trim());
    const values = valueRow.split(",").map((item) => item.trim());
    return headers.reduce<Record<string, unknown>>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  }
}

export function summarizeUsageRow(
  rawUsageRow?: Record<string, unknown> | null,
): UsageSummary | undefined {
  if (!rawUsageRow) {
    return undefined;
  }

  const sourceId = "usage-1";
  return {
    sourceId,
    sourceType: "usage",
    accountName:
      String(rawUsageRow[USAGE_COLUMN_MAP.organizationName] || "Usage Attachments"),
    accountManager: String(rawUsageRow[USAGE_COLUMN_MAP.accountManager] || "") || undefined,
    vertical: String(rawUsageRow[USAGE_COLUMN_MAP.organizationVertical] || "") || undefined,
    arrUsd: toNumber(rawUsageRow[USAGE_COLUMN_MAP.currentArrUsd]),
    mrrUsd: toNumber(rawUsageRow[USAGE_COLUMN_MAP.currentMrrUsd]),
    reviews: {
      invitesLast30Days: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.reviewInvitesLast30Days],
      ),
      allTimeInvites: toNumber(rawUsageRow[USAGE_COLUMN_MAP.allTimeReviewInvites]),
      lifetimeAttributedReviews: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.lifetimeAttributedReviews],
      ),
      lifetimeTotalReviews: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.lifetimeTotalReviews],
      ),
      averageTotalRating: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.lifetimeAverageTotalRating],
      ),
    },
    webchat: {
      leadsLast30Days: toNumber(rawUsageRow[USAGE_COLUMN_MAP.webchatLeadsLast30Days]),
      totalLeads: toNumber(rawUsageRow[USAGE_COLUMN_MAP.totalLeadsReceived]),
    },
    messaging: {
      receivedLast30Days: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.receivedMessagesLast30Days],
      ),
      sentLast30Days: toNumber(rawUsageRow[USAGE_COLUMN_MAP.sentMessagesLast30Days]),
      totalConversationItems: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.totalConversationItems],
      ),
    },
    ai: {
      status: String(rawUsageRow[USAGE_COLUMN_MAP.aiStatus] || "") || undefined,
      products: parseJsonList(rawUsageRow[USAGE_COLUMN_MAP.aiProductNames]),
      conversationsLast28Days: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.aiConversationsLast28Days],
      ),
      leadsQualifiedLast28Days: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.aiLeadsQualifiedLast28Days],
      ),
    },
    phones: {
      status:
        String(rawUsageRow[USAGE_COLUMN_MAP.phonesProductStatus] || "") || undefined,
      missedCallsLast30Days: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.missedCallsLast30Days],
      ),
      lifetimeCalls: toNumber(rawUsageRow["LIFETIME CALLS"]),
    },
    payments: {
      processedAmountLast30Days: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.processedAmountLast30Days],
      ),
      processedAmountLast90Days: toNumber(
        rawUsageRow[USAGE_COLUMN_MAP.processedAmountLast90Days],
      ),
    },
    integrations: parseJsonList(rawUsageRow[USAGE_COLUMN_MAP.integrationNames]),
    raw: rawUsageRow,
  };
}

function buildUsageContext(usage?: UsageSummary) {
  if (!usage) {
    return "No usage data attached.";
  }

  return [
    `SOURCE ${usage.sourceId} (usage) — ${usage.accountName}`,
    `Vertical: ${usage.vertical || "unknown"}`,
    `Account manager: ${usage.accountManager || "unknown"}`,
    `ARR USD: ${usage.arrUsd ?? "unknown"} | MRR USD: ${usage.mrrUsd ?? "unknown"}`,
    `Reviews: invites last 30 days=${usage.reviews.invitesLast30Days ?? "n/a"}, all time invites=${usage.reviews.allTimeInvites ?? "n/a"}, lifetime attributed reviews=${usage.reviews.lifetimeAttributedReviews ?? "n/a"}, lifetime total reviews=${usage.reviews.lifetimeTotalReviews ?? "n/a"}, average total rating=${usage.reviews.averageTotalRating ?? "n/a"}`,
    `Webchat: leads last 30 days=${usage.webchat.leadsLast30Days ?? "n/a"}, total leads=${usage.webchat.totalLeads ?? "n/a"}`,
    `Messaging: received last 30 days=${usage.messaging.receivedLast30Days ?? "n/a"}, sent last 30 days=${usage.messaging.sentLast30Days ?? "n/a"}, total conversation items=${usage.messaging.totalConversationItems ?? "n/a"}`,
    `AI: status=${usage.ai.status || "n/a"}, products=${usage.ai.products.join(", ") || "none"}, conversations last 28 days=${usage.ai.conversationsLast28Days ?? "n/a"}, leads qualified last 28 days=${usage.ai.leadsQualifiedLast28Days ?? "n/a"}`,
    `Phones: status=${usage.phones.status || "n/a"}, missed calls last 30 days=${usage.phones.missedCallsLast30Days ?? "n/a"}, lifetime calls=${usage.phones.lifetimeCalls ?? "n/a"}`,
    `Payments: processed amount last 30 days=${usage.payments.processedAmountLast30Days ?? "n/a"}, processed amount last 90 days=${usage.payments.processedAmountLast90Days ?? "n/a"}`,
    `Integrations: ${usage.integrations.join(", ") || "none"}`,
  ].join("\n");
}

export function normalizeAccountInput({
  accountName,
  transcripts = [],
  emails = [],
  usageRow,
  usageText,
}: NormalizeAccountInputArgs): NormalizedAccountInput {
  const normalizedTranscripts = normalizeSources("call", transcripts);
  const normalizedEmails = normalizeSources("email", emails);
  const parsedUsage = usageRow || parseUsageText(usageText);
  const usage = summarizeUsageRow(parsedUsage);

  const sourceMap = [...normalizedTranscripts, ...normalizedEmails].reduce<
    Record<string, NormalizedSource>
  >((acc, source) => {
    acc[source.id] = source;
    return acc;
  }, {});

  if (usage) {
    sourceMap[usage.sourceId] = {
      id: usage.sourceId,
      type: "usage",
      label: usage.accountName,
      content: buildUsageContext(usage),
    };
  }

  const transcriptContext = buildContext(normalizedTranscripts);
  const emailContext = buildContext(normalizedEmails);
  const usageContext = buildUsageContext(usage);

  return {
    accountName,
    transcripts: normalizedTranscripts,
    emails: normalizedEmails,
    usage,
    sourceMap,
    transcriptContext,
    emailContext,
    usageContext,
    combinedContext: [transcriptContext, emailContext, usageContext]
      .filter(Boolean)
      .join("\n\n====\n\n"),
  };
}

export function collectEvidenceSnippets(
  evidence: Evidence[],
  sourceMap: Record<string, NormalizedSource>,
) {
  return evidence.map((item) => ({
    ...item,
    sourceLabel: sourceMap[item.sourceId]?.label || item.sourceId,
  }));
}
