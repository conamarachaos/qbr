import { type OppType, type Prisma } from "@prisma/client";

import { applyEditedBrief, type EditableBrief } from "@/lib/brief-export";
import { deriveHealth } from "@/lib/dataset-derive";
import { prisma } from "@/lib/db";
import { normalizeAccountInput } from "@/lib/ingest";
import { runPipeline, type PipelineRunOptions, type PipelineRunResult } from "@/lib/pipeline";
import { PersistedBriefDataSchema, type PersistedBriefData } from "@/lib/persisted-brief";
import { buildAccountAccessWhere } from "@/lib/repo/access";
import { indexAccountSources } from "@/lib/repo/chunks";
import { type DbClient, type SessionContext } from "@/lib/repo/types";

function getCurrentQuarter(date = new Date()) {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${quarter}`;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function serializeSourceMap(input: PipelineRunResult["input"]["sourceMap"]) {
  return Object.fromEntries(
    Object.entries(input).map(([sourceId, source]) => [
      sourceId,
      {
        label: source.label,
        content: source.content,
        type: source.type,
      },
    ]),
  );
}

async function loadAccountForRun(
  context: SessionContext,
  accountId: string,
  db: DbClient,
) {
  return db.account.findFirst({
    where: buildAccountAccessWhere(context, accountId),
    include: {
      sources: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

function buildNormalizedInput(account: Awaited<ReturnType<typeof loadAccountForRun>>) {
  if (!account) {
    throw new Error("Account not found.");
  }

  const usageSource = [...account.sources]
    .reverse()
    .find((source) => source.type === "usage");

  return normalizeAccountInput({
    accountName: account.name,
    transcripts: account.sources
      .filter((source) => source.type === "call")
      .map((source) => ({
        id: source.id,
        label: source.label,
        type: "call" as const,
        content: source.content,
      })),
    emails: account.sources
      .filter((source) => source.type === "email")
      .map((source) => ({
        id: source.id,
        label: source.label,
        type: "email" as const,
        content: source.content,
      })),
    usageText: usageSource?.content,
  });
}

export async function executeAccountRun(
  context: SessionContext,
  accountId: string,
  options: {
    pipelineRunner?: typeof runPipeline;
    onStage?: PipelineRunOptions["onStage"];
  } = {},
  db: DbClient = prisma,
) {
  const account = await loadAccountForRun(context, accountId, db);
  if (!account) {
    throw new Error("Account not found.");
  }

  const qbrRun = await db.qbrRun.create({
    data: {
      accountId: account.id,
      triggeredById: context.userId,
      status: "running",
      period: getCurrentQuarter(),
      modelMeta: toInputJson({
        extractionModel: process.env.EXTRACTION_MODEL ?? null,
        narrativeModel: process.env.NARRATIVE_MODEL ?? null,
      }),
    },
  });

  const pipelineRunner = options.pipelineRunner ?? runPipeline;

  try {
    const input = buildNormalizedInput(account);
    const result = await pipelineRunner(input, {
      onStage: options.onStage,
    });

    await db.qbrRun.update({
      where: {
        id: qbrRun.id,
      },
      data: {
        status: "ready",
        usageTotals: toInputJson(result.usageTotals),
        stages: toInputJson(result.stages),
        goals: toInputJson(result.goals),
        usage: toInputJson(result.usage),
        gaps: toInputJson(result.gaps),
        opportunities: toInputJson(result.opportunities),
      },
    });

    await db.brief.create({
      data: {
        qbrRunId: qbrRun.id,
        data: toInputJson({
          brief: result.brief,
          sourceMap: serializeSourceMap(result.input.sourceMap),
        }),
      },
    });

    await db.opportunity.createMany({
      data: result.opportunities.opportunities.map((opportunity) => ({
        accountId: account.id,
        qbrRunId: qbrRun.id,
        feature: opportunity.feature,
        title: opportunity.title,
        pitch: opportunity.pitch,
        expectedImpact: opportunity.expectedImpact,
        score: opportunity.score,
        type: "expansion" as OppType,
        stage: "identified",
      })),
    });

    await db.gap.createMany({
      data: result.gaps.gaps.map((gap) => ({
        accountId: account.id,
        qbrRunId: qbrRun.id,
        feature: gap.feature,
        reason: gap.reason,
        severity: gap.severity,
        status: "open" as const,
      })),
    });

    // Seed action items from the brief's AI-recommended "asks" so the account's
    // action plan starts populated. Deduped against existing open items (by title)
    // so re-running a QBR doesn't pile up duplicates. Non-fatal.
    try {
      const asks = result.brief.qbrOutline.asks
        .map((ask) => ask.trim())
        .filter((ask) => ask.length > 0);
      if (asks.length > 0) {
        const existing = await db.actionItem.findMany({
          where: { accountId: account.id, status: { not: "done" } },
          select: { title: true },
        });
        const seen = new Set(existing.map((item) => item.title.trim().toLowerCase()));
        const fresh = asks.filter((ask) => !seen.has(ask.toLowerCase()));
        if (fresh.length > 0) {
          await db.actionItem.createMany({
            data: fresh.map((title) => ({
              accountId: account.id,
              qbrRunId: qbrRun.id,
              title,
              ownerId: context.userId,
            })),
          });
        }
      }
    } catch (error) {
      console.warn("Post-run action item seeding failed:", error);
    }

    // Recompute the account's health score from the data this run was built on,
    // mirroring importDatasetAccount() so UI-created accounts stop showing as
    // "Unscored" on the dashboard. Isolated so it never fails a completed run.
    try {
      const health = deriveHealth({
        transcriptCount: input.transcripts.length,
        usageProducts: input.usage?.ai.products.length ?? 0,
        reviewInvites: input.usage?.reviews.invitesLast30Days,
        missedCalls: input.usage?.phones.missedCallsLast30Days,
      });
      await db.healthScore.create({
        data: {
          accountId: account.id,
          overall: health.overall,
          category: health.category,
          components: toInputJson(health.components),
        },
      });
    } catch (error) {
      console.warn("Post-run health score update failed (dashboard health may be stale):", error);
    }

    // Ensure the account's sources are searchable by the chat panel. This must
    // never fail a completed QBR run, so it is isolated in its own try/catch.
    try {
      await indexAccountSources(context, account.id, db);
    } catch (error) {
      console.warn("Post-run chunk indexing failed (chat search may be stale):", error);
    }

    return {
      runId: qbrRun.id,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    await db.qbrRun.update({
      where: {
        id: qbrRun.id,
      },
      data: {
        status: "failed",
        error: message,
      },
    });
    throw error;
  }
}

export async function getRunDetail(
  context: SessionContext,
  accountId: string,
  runId: string,
  db: DbClient = prisma,
) {
  return db.qbrRun.findFirst({
    where: {
      id: runId,
      accountId,
      account: buildAccountAccessWhere(context, accountId),
    },
    include: {
      account: {
        include: {
          ownerships: {
            include: {
              user: true,
            },
          },
        },
      },
      brief: true,
    },
  });
}

export function parsePersistedBriefData(data: Prisma.JsonValue): PersistedBriefData {
  return PersistedBriefDataSchema.parse(data);
}

export async function saveBriefEdits(
  context: SessionContext,
  input: {
    accountId: string;
    runId: string;
    editedBrief: EditableBrief;
    approve?: boolean;
  },
  db: DbClient = prisma,
) {
  const run = await getRunDetail(context, input.accountId, input.runId, db);
  if (!run?.brief) {
    throw new Error("QBR run not found.");
  }

  const currentData = parsePersistedBriefData(run.brief.data);
  const updatedBrief = applyEditedBrief(currentData.brief, input.editedBrief);

  return db.brief.update({
    where: {
      qbrRunId: run.id,
    },
    data: {
      edited: true,
      approvedAt: input.approve ? new Date() : run.brief.approvedAt,
      data: toInputJson({
        brief: updatedBrief,
        editedBrief: input.editedBrief,
        sourceMap: currentData.sourceMap,
      }),
    },
  });
}
