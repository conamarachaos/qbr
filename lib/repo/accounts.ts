import {
  ActionStatus,
  type GapStatus,
  type Lifecycle,
  type OppStage,
  type Prisma,
  type SourceType,
  type Tier,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { loadSeedDataset } from "@/lib/dataset";
import {
  currentQuarter,
  deriveHealth,
  deriveRenewalDate,
  deriveTier,
} from "@/lib/dataset-derive";
import { summarizeUsageRow } from "@/lib/ingest";
import { buildAccountAccessWhere, buildVisibleAccountsWhere } from "@/lib/repo/access";
import { indexAccountSources } from "@/lib/repo/chunks";
import {
  classifyUploadedFiles,
  matchExistingAccount,
  normalizeAccountName,
  type ClassifiedFile,
  type UploadedFile,
} from "@/lib/repo/ingest-router";
import { type DbClient, type SessionContext } from "@/lib/repo/types";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const portfolioInclude = {
  ownerships: {
    include: {
      user: true,
    },
  },
  healthScores: {
    orderBy: {
      asOf: "desc",
    },
    take: 1,
  },
  qbrRuns: {
    where: {
      status: "ready",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
  },
} satisfies Prisma.AccountInclude;

const detailInclude = {
  ownerships: {
    include: {
      user: true,
    },
  },
  healthScores: {
    orderBy: {
      asOf: "desc",
    },
  },
  qbrRuns: {
    orderBy: {
      createdAt: "desc",
    },
    include: {
      brief: true,
    },
  },
  sources: {
    orderBy: {
      createdAt: "desc",
    },
  },
  usageSnapshots: {
    orderBy: {
      createdAt: "desc",
    },
  },
  opportunities: {
    orderBy: {
      createdAt: "desc",
    },
  },
  actionItems: {
    orderBy: [
      {
        dueDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  },
} satisfies Prisma.AccountInclude;

function computeQbrDue(lastQbrAt?: Date | null, renewalDate?: Date | null) {
  const now = Date.now();
  const ninetyDays = 1000 * 60 * 60 * 24 * 90;
  const fortyFiveDays = 1000 * 60 * 60 * 24 * 45;

  if (!lastQbrAt) {
    return true;
  }

  if (now - lastQbrAt.getTime() > ninetyDays) {
    return true;
  }

  return renewalDate ? renewalDate.getTime() - now < fortyFiveDays : false;
}

export async function listPortfolioAccounts(
  context: SessionContext,
  filters: {
    tier?: Tier | "all";
    sort?: "renewal-asc" | "renewal-desc";
  } = {},
  db: DbClient = prisma,
) {
  const where: Prisma.AccountWhereInput = {
    ...buildVisibleAccountsWhere(context),
    ...(filters.tier && filters.tier !== "all" ? { tier: filters.tier } : {}),
  };

  const orderBy: Prisma.AccountOrderByWithRelationInput[] =
    filters.sort === "renewal-desc"
      ? [{ renewalDate: "desc" }, { name: "asc" }]
      : [{ renewalDate: "asc" }, { name: "asc" }];

  const accounts = await db.account.findMany({
    where,
    include: portfolioInclude,
    orderBy,
  });

  return accounts.map((account) => {
    const latestHealth = account.healthScores[0] ?? null;
    const latestQbr = account.qbrRuns[0] ?? null;

    return {
      ...account,
      latestHealth,
      latestQbr,
      qbrDue: computeQbrDue(latestQbr?.createdAt, account.renewalDate),
    };
  });
}

export async function createAccount(
  context: SessionContext,
  input: {
    name: string;
    vertical?: string;
    tier?: Tier;
    arr?: number | null;
    renewalDate?: Date | null;
    lifecycle?: Lifecycle;
  },
  db: DbClient = prisma,
) {
  return db.account.create({
    data: {
      workspaceId: context.workspaceId,
      createdById: context.userId,
      name: input.name,
      vertical: input.vertical,
      tier: input.tier ?? "growth",
      arr: input.arr ?? null,
      renewalDate: input.renewalDate ?? null,
      lifecycle: input.lifecycle ?? "active",
      ownerships: {
        create: {
          userId: context.userId,
          role: "primary_am",
        },
      },
    },
  });
}

export interface DatasetImportOption {
  transcriptAccountId: string;
  name: string;
  transcriptCount: number;
  usageAccountName: string | null;
  vertical: string | null;
  arrUsd: number | null;
  alreadyImported: boolean;
}

export async function listDatasetImportOptions(
  context: SessionContext,
  db: DbClient = prisma,
): Promise<DatasetImportOption[]> {
  const dataset = await loadSeedDataset();

  const existing = await db.account.findMany({
    where: buildVisibleAccountsWhere(context),
    select: { name: true },
  });
  const existingNames = new Set(existing.map((account) => account.name));

  return dataset.mappings.flatMap((mapping) => {
    const transcriptAccount = dataset.transcriptAccounts.find(
      (account) => account.id === mapping.transcriptAccountId,
    );
    if (!transcriptAccount) {
      return [];
    }

    const usageOption = mapping.usageAccountName
      ? dataset.usageOptions.find((option) => option.name === mapping.usageAccountName)
      : undefined;
    const usageSummary = summarizeUsageRow(usageOption?.row);

    return [
      {
        transcriptAccountId: transcriptAccount.id,
        name: transcriptAccount.name,
        transcriptCount: transcriptAccount.transcriptCount,
        usageAccountName: mapping.usageAccountName ?? null,
        vertical: usageSummary?.vertical ?? null,
        arrUsd: usageSummary?.arrUsd ?? null,
        alreadyImported: existingNames.has(transcriptAccount.name),
      },
    ];
  });
}

export async function importDatasetAccount(
  context: SessionContext,
  transcriptAccountId: string,
  db: DbClient = prisma,
) {
  const dataset = await loadSeedDataset();

  const index = dataset.mappings.findIndex(
    (mapping) => mapping.transcriptAccountId === transcriptAccountId,
  );
  const mapping = index >= 0 ? dataset.mappings[index] : undefined;
  if (!mapping) {
    throw new Error("Unknown dataset account.");
  }

  const transcriptAccount = dataset.transcriptAccounts.find(
    (account) => account.id === mapping.transcriptAccountId,
  );
  if (!transcriptAccount) {
    throw new Error("Dataset transcripts not found.");
  }

  const existing = await db.account.findFirst({
    where: {
      ...buildVisibleAccountsWhere(context),
      name: transcriptAccount.name,
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`${transcriptAccount.name} is already in this workspace.`);
  }

  const usageOption = mapping.usageAccountName
    ? dataset.usageOptions.find((option) => option.name === mapping.usageAccountName)
    : undefined;
  const usageSummary = summarizeUsageRow(usageOption?.row);
  const health = deriveHealth({
    transcriptCount: transcriptAccount.transcriptCount,
    usageProducts: usageSummary?.ai.products.length ?? 0,
    reviewInvites: usageSummary?.reviews.invitesLast30Days,
    missedCalls: usageSummary?.phones.missedCallsLast30Days,
  });

  const account = await db.account.create({
    data: {
      workspaceId: context.workspaceId,
      createdById: context.userId,
      name: transcriptAccount.name,
      vertical: usageSummary?.vertical ?? null,
      tier: deriveTier(usageSummary?.arrUsd),
      arr: usageSummary?.arrUsd ?? null,
      renewalDate: deriveRenewalDate(index),
      lifecycle: "active",
      ownerships: {
        create: {
          userId: context.userId,
          role: "primary_am",
        },
      },
      sources: {
        create: [
          ...transcriptAccount.transcripts.map((transcript) => ({
            type: transcript.type,
            label: transcript.label ?? `${transcript.type} transcript`,
            content: transcript.content,
            uploadedById: context.userId,
          })),
          ...(usageOption
            ? [
                {
                  type: "usage" as const,
                  label: `${usageOption.name} usage snapshot`,
                  content: JSON.stringify(usageOption.row, null, 2),
                  uploadedById: context.userId,
                },
              ]
            : []),
        ],
      },
      usageSnapshots: {
        create: {
          period: currentQuarter(),
          data: toInputJson(
            usageSummary?.raw ?? {
              note: "No usage row was provided for this transcript account in the source dataset.",
            },
          ),
        },
      },
      healthScores: {
        create: {
          overall: health.overall,
          category: health.category,
          components: toInputJson(health.components),
        },
      },
    },
  });

  // Index the freshly attached sources so the Ask/RAG feature works immediately.
  await indexAccountSources(context, account.id, db);

  return account;
}

export interface UploadFileProposal {
  fileId: string;
  filename: string;
  sourceType: SourceType;
  proposedAccountName: string;
  matchedAccountId: string | null;
  matchedAccountName: string | null;
  vertical: string | null;
  arrUsd: number | null;
  confidence: number;
  reasoning: string;
}

export interface UploadPreview {
  proposals: UploadFileProposal[];
  skipped: Array<{ filename: string; reason: string }>;
}

// Phase 1 (no writes): classify the files and resolve each to an existing
// account (fuzzy match) or a proposed new account. The UI shows these for the
// user to confirm/adjust before anything is committed.
export async function previewUpload(
  context: SessionContext,
  files: UploadedFile[],
  db: DbClient = prisma,
  classifyImpl: typeof classifyUploadedFiles = classifyUploadedFiles,
): Promise<UploadPreview> {
  const skipped: UploadPreview["skipped"] = [];
  const usable = files.filter((file) => {
    if (!file.content.trim()) {
      skipped.push({ filename: file.filename, reason: "Empty file." });
      return false;
    }
    return true;
  });

  // Tiered + batched: structural-first, then a single routing-model call for
  // the leftovers (see ingest-router).
  const classified: ClassifiedFile[] = await classifyImpl(usable);

  const existing = await db.account.findMany({
    where: buildVisibleAccountsWhere(context),
    select: { id: true, name: true },
  });

  const proposals = classified.map((file, index) => {
    const match = matchExistingAccount(file.accountName, existing);
    return {
      fileId: `f${index}`,
      filename: file.filename,
      sourceType: file.sourceType,
      proposedAccountName: file.accountName,
      matchedAccountId: match?.id ?? null,
      matchedAccountName: match?.name ?? null,
      vertical: file.vertical,
      arrUsd: file.arrUsd,
      confidence: file.confidence,
      reasoning: file.reasoning,
    } satisfies UploadFileProposal;
  });

  return { proposals, skipped };
}

// A confirmed decision for one file, sent back from the UI after the user
// reviews the preview. Either attach to an existing account, or create one.
export interface UploadDecision {
  filename: string;
  content: string;
  sourceType: SourceType;
  // When set, attach to this existing account; otherwise create `accountName`.
  accountId: string | null;
  accountName: string;
  vertical: string | null;
  arrUsd: number | null;
}

export interface IngestUploadResult {
  accounts: Array<{
    accountId: string;
    accountName: string;
    created: boolean;
    sourceCount: number;
    files: Array<{ filename: string; sourceType: SourceType }>;
  }>;
}

// Phase 2 (writes): commit the user-confirmed decisions — create new accounts,
// attach each file as a source, and index for Ask. Files are grouped so a batch
// for one account lands together.
export async function commitUpload(
  context: SessionContext,
  decisions: UploadDecision[],
  db: DbClient = prisma,
): Promise<IngestUploadResult> {
  // Track accounts created during this commit so multiple files targeting the
  // same new account name resolve to one record.
  const createdByName = new Map<string, { id: string; name: string }>();
  const byAccount = new Map<string, IngestUploadResult["accounts"][number]>();

  for (const decision of decisions) {
    if (!decision.content.trim()) continue;

    let accountId = decision.accountId;
    let accountName = decision.accountName;
    let created = false;

    if (!accountId) {
      const key = normalizeAccountName(decision.accountName) || decision.accountName;
      const already = createdByName.get(key);
      if (already) {
        accountId = already.id;
        accountName = already.name;
      } else {
        const account = await createAccount(
          context,
          {
            name: decision.accountName,
            vertical: decision.vertical ?? undefined,
            tier: deriveTier(decision.arrUsd),
            arr: decision.arrUsd,
          },
          db,
        );
        accountId = account.id;
        accountName = account.name;
        created = true;
        createdByName.set(key, { id: account.id, name: account.name });
      }
    } else {
      // Verify the caller actually has access to this account.
      const account = await db.account.findFirst({
        where: buildAccountAccessWhere(context, accountId),
        select: { id: true, name: true },
      });
      if (!account) {
        throw new Error("Account not found.");
      }
      accountName = account.name;
    }

    await db.source.create({
      data: {
        accountId,
        label: decision.filename,
        type: decision.sourceType,
        content: decision.content,
        uploadedById: context.userId,
      },
    });

    const entry = byAccount.get(accountId) ?? {
      accountId,
      accountName,
      created,
      sourceCount: 0,
      files: [],
    };
    entry.sourceCount += 1;
    entry.files.push({ filename: decision.filename, sourceType: decision.sourceType });
    byAccount.set(accountId, entry);
  }

  for (const accountId of byAccount.keys()) {
    await indexAccountSources(context, accountId, db);
  }

  return { accounts: [...byAccount.values()] };
}

export async function getAccountDetail(
  context: SessionContext,
  accountId: string,
  db: DbClient = prisma,
) {
  return db.account.findFirst({
    where: buildAccountAccessWhere(context, accountId),
    include: detailInclude,
  });
}

export async function updateAccount(
  context: SessionContext,
  input: {
    accountId: string;
    name?: string;
    vertical?: string | null;
    tier?: Tier;
    arr?: number | null;
    renewalDate?: Date | null;
    lifecycle?: Lifecycle;
  },
  db: DbClient = prisma,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, input.accountId),
    select: {
      id: true,
    },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  const data: Prisma.AccountUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.vertical !== undefined) data.vertical = input.vertical;
  if (input.tier !== undefined) data.tier = input.tier;
  if (input.arr !== undefined) data.arr = input.arr;
  if (input.renewalDate !== undefined) data.renewalDate = input.renewalDate;
  if (input.lifecycle !== undefined) data.lifecycle = input.lifecycle;

  return db.account.update({
    where: {
      id: account.id,
    },
    data,
  });
}

export async function deleteAccount(
  context: SessionContext,
  accountId: string,
  db: DbClient = prisma,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, accountId),
    select: {
      id: true,
    },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  await db.account.delete({
    where: {
      id: account.id,
    },
  });

  return { id: account.id };
}

export async function addAccountSource(
  context: SessionContext,
  input: {
    accountId: string;
    label: string;
    type: SourceType;
    content: string;
  },
  db: DbClient = prisma,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, input.accountId),
    select: {
      id: true,
    },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  const source = await db.source.create({
    data: {
      accountId: account.id,
      label: input.label,
      type: input.type,
      content: input.content,
      uploadedById: context.userId,
    },
  });

  // Keep the chat embedding index fresh. Never let an embedding failure block the
  // (successful) source save — the chatbot is additive to the core product.
  try {
    await indexAccountSources(context, account.id, db);
  } catch (error) {
    console.warn("Source chunk indexing failed (chat search may be stale):", error);
  }

  return source;
}

export async function createActionItem(
  context: SessionContext,
  input: {
    accountId: string;
    qbrRunId?: string;
    title: string;
    dueDate?: Date | null;
  },
  db: DbClient = prisma,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, input.accountId),
    select: {
      id: true,
    },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  return db.actionItem.create({
    data: {
      accountId: account.id,
      qbrRunId: input.qbrRunId,
      title: input.title,
      ownerId: context.userId,
      dueDate: input.dueDate ?? null,
      status: ActionStatus.open,
    },
  });
}

async function findActionItemForContext(
  context: SessionContext,
  actionItemId: string,
  db: DbClient,
) {
  const item = await db.actionItem.findFirst({
    where: {
      id: actionItemId,
      account: buildVisibleAccountsWhere(context),
    },
    select: { id: true, accountId: true },
  });
  if (!item) {
    throw new Error("Action item not found.");
  }
  return item;
}

export async function updateActionItemStatus(
  context: SessionContext,
  input: {
    actionItemId: string;
    status: ActionStatus;
  },
  db: DbClient = prisma,
) {
  const item = await findActionItemForContext(context, input.actionItemId, db);
  return db.actionItem.update({
    where: { id: item.id },
    data: { status: input.status },
  });
}

export async function deleteActionItem(
  context: SessionContext,
  input: { actionItemId: string },
  db: DbClient = prisma,
) {
  const item = await findActionItemForContext(context, input.actionItemId, db);
  return db.actionItem.delete({
    where: { id: item.id },
  });
}

export async function updateOpportunityStage(
  context: SessionContext,
  input: {
    accountId: string;
    opportunityId: string;
    stage: OppStage;
  },
  db: DbClient = prisma,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, input.accountId),
    select: {
      id: true,
    },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  const opportunity = await db.opportunity.findFirst({
    where: {
      id: input.opportunityId,
      accountId: account.id,
    },
    select: {
      id: true,
    },
  });

  if (!opportunity) {
    throw new Error("Opportunity not found.");
  }

  return db.opportunity.update({
    where: {
      id: opportunity.id,
    },
    data: {
      stage: input.stage,
    },
  });
}

export interface DashboardSummary {
  totals: {
    accounts: number;
    arr: number;
    qbrsRun: number;
    avgHealth: number | null;
  };
  health: { healthy: number; at_risk: number; critical: number; unknown: number };
  attention: Array<{
    id: string;
    name: string;
    tier: Tier;
    arr: number | null;
    renewalDate: Date | null;
    health: number | null;
    healthCategory: string | null;
    qbrDue: boolean;
    renewalSoon: boolean;
    lastQbrAt: Date | null;
  }>;
  renewalsDue: number;
  qbrsDue: number;
  pipeline: {
    openCount: number;
    openValue: number;
    wonValue: number;
    byStage: Record<string, { count: number; value: number }>;
  };
  recentRuns: Array<{
    id: string;
    accountId: string;
    accountName: string;
    status: string;
    period: string | null;
    createdAt: Date;
    approved: boolean;
  }>;
}

const OPEN_OPP_STAGES = ["identified", "qualified", "proposed"] as const;

export async function getDashboardSummary(
  context: SessionContext,
  db: DbClient = prisma,
): Promise<DashboardSummary> {
  const visible = buildVisibleAccountsWhere(context);

  const [accounts, recentRunRows, opportunities] = await Promise.all([
    db.account.findMany({
      where: visible,
      include: {
        healthScores: { orderBy: { asOf: "desc" }, take: 1 },
        qbrRuns: {
          where: { status: "ready" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { qbrRuns: true } },
      },
    }),
    db.qbrRun.findMany({
      where: { account: visible },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        account: { select: { id: true, name: true } },
        brief: { select: { approvedAt: true } },
      },
    }),
    db.opportunity.findMany({
      where: { account: visible },
      select: { stage: true, amount: true },
    }),
  ]);

  const health = { healthy: 0, at_risk: 0, critical: 0, unknown: 0 };
  let arrTotal = 0;
  let healthSum = 0;
  let healthCount = 0;
  let qbrsRun = 0;
  let renewalsDue = 0;
  let qbrsDue = 0;
  const now = Date.now();
  const fortyFiveDays = 1000 * 60 * 60 * 24 * 45;

  const attention: DashboardSummary["attention"] = [];

  for (const account of accounts) {
    arrTotal += account.arr ?? 0;
    qbrsRun += account._count.qbrRuns;
    const latestHealth = account.healthScores[0] ?? null;
    if (latestHealth) {
      healthSum += latestHealth.overall;
      healthCount += 1;
      health[latestHealth.category] += 1;
    } else {
      health.unknown += 1;
    }

    const lastQbrAt = account.qbrRuns[0]?.createdAt ?? null;
    const due = computeQbrDue(lastQbrAt, account.renewalDate);
    const renewalSoon = account.renewalDate
      ? account.renewalDate.getTime() - now < fortyFiveDays
      : false;
    if (due) qbrsDue += 1;
    if (renewalSoon) renewalsDue += 1;

    const critical = latestHealth?.category === "critical";
    const atRisk = latestHealth?.category === "at_risk";
    if (due || renewalSoon || critical || atRisk) {
      attention.push({
        id: account.id,
        name: account.name,
        tier: account.tier,
        arr: account.arr,
        renewalDate: account.renewalDate,
        health: latestHealth?.overall ?? null,
        healthCategory: latestHealth?.category ?? null,
        qbrDue: due,
        renewalSoon,
        lastQbrAt,
      });
    }
  }

  // Most urgent first: critical health, then renewal proximity, then QBR due.
  const rank = (a: DashboardSummary["attention"][number]) =>
    (a.healthCategory === "critical" ? 0 : a.healthCategory === "at_risk" ? 1 : 2);
  attention.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    const ar = a.renewalDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const br = b.renewalDate?.getTime() ?? Number.POSITIVE_INFINITY;
    return ar - br;
  });

  const byStage: Record<string, { count: number; value: number }> = {};
  let openCount = 0;
  let openValue = 0;
  let wonValue = 0;
  for (const opp of opportunities) {
    const bucket = (byStage[opp.stage] ??= { count: 0, value: 0 });
    bucket.count += 1;
    bucket.value += opp.amount ?? 0;
    if ((OPEN_OPP_STAGES as readonly string[]).includes(opp.stage)) {
      openCount += 1;
      openValue += opp.amount ?? 0;
    }
    if (opp.stage === "won") wonValue += opp.amount ?? 0;
  }

  return {
    totals: {
      accounts: accounts.length,
      arr: arrTotal,
      qbrsRun,
      avgHealth: healthCount ? Math.round(healthSum / healthCount) : null,
    },
    health,
    attention: attention.slice(0, 6),
    renewalsDue,
    qbrsDue,
    pipeline: { openCount, openValue, wonValue, byStage },
    recentRuns: recentRunRows.map((run) => ({
      id: run.id,
      accountId: run.accountId,
      accountName: run.account.name,
      status: run.status,
      period: run.period,
      createdAt: run.createdAt,
      approved: Boolean(run.brief?.approvedAt),
    })),
  };
}

export async function listWorkspaceOpportunities(
  context: SessionContext,
  db: DbClient = prisma,
) {
  return db.opportunity.findMany({
    where: {
      account: buildVisibleAccountsWhere(context),
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          tier: true,
        },
      },
    },
    orderBy: [
      {
        stage: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function listWorkspaceGaps(
  context: SessionContext,
  db: DbClient = prisma,
) {
  return db.gap.findMany({
    where: {
      account: buildVisibleAccountsWhere(context),
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          tier: true,
        },
      },
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        severity: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function updateGapStatus(
  context: SessionContext,
  input: {
    accountId: string;
    gapId: string;
    status: GapStatus;
  },
  db: DbClient = prisma,
) {
  const account = await db.account.findFirst({
    where: buildAccountAccessWhere(context, input.accountId),
    select: { id: true },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  const gap = await db.gap.findFirst({
    where: {
      id: input.gapId,
      accountId: account.id,
    },
    select: { id: true },
  });

  if (!gap) {
    throw new Error("Gap not found.");
  }

  return db.gap.update({
    where: { id: gap.id },
    data: { status: input.status },
  });
}
