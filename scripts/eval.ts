import { PRODUCT_CATALOG, type ProductFeature } from "@/lib/catalog";
import { loadTranscriptAccounts, loadUsageRows } from "@/lib/dataset";
import { evaluatePipelineStructure } from "@/lib/eval";
import {
  normalizeAccountInput,
  type NormalizedAccountInput,
  type NormalizedSource,
} from "@/lib/ingest";
import { runPipeline } from "@/lib/pipeline";
import type { GenerateObjectLike } from "@/lib/pipeline/shared";
import type {
  Evidence,
  GoalsResult,
  GapsResult,
  NarrativeResult,
  OpportunitiesResult,
  UsageResult,
} from "@/lib/schemas";

type OfflineFixtureTemplate = {
  goals: Array<{ title: string; description: string }>;
  gaps: Array<{
    feature: ProductFeature;
    reason: string;
    expectedImpact: string;
    pitch?: string;
  }>;
};

const OFFLINE_FIXTURES: Record<string, OfflineFixtureTemplate> = {
  apex: {
    goals: [
      {
        title: "Protect a strong local reputation while the team stays lean",
        description:
          "The customer is efficient today and needs systems that scale without adding overhead.",
      },
      {
        title: "Capture more inbound demand when prospects are evaluating options",
        description:
          "The business needs an easier path from awareness to a live conversation.",
      },
      {
        title: "Standardize follow-up before growth accelerates",
        description:
          "The team wants operational coverage before more demand hits the business.",
      },
    ],
    gaps: [
      {
        feature: "Reviews",
        reason: "A strong rating is in place, but there is no repeatable invite motion protecting review velocity.",
        expectedImpact: "Keep reputation growth compounding as the team adds more work.",
      },
      {
        feature: "Webchat",
        reason: "Prospects researching online do not have a fast path into a conversation after the first website visit.",
        expectedImpact: "Turn more site traffic into bookable conversations without waiting on a callback.",
      },
      {
        feature: "Messaging",
        reason: "The team is still lightweight enough that customer follow-up can live in ad hoc channels.",
        expectedImpact: "Create a cleaner, shared follow-up workflow before demand scales.",
      },
    ],
  },
  "meridian-furniture": {
    goals: [
      {
        title: "Make automation follow-up reliable",
        description:
          "The account wants status-based messaging to trigger consistently instead of failing silently.",
      },
      {
        title: "Give the team more visibility into operational follow-through",
        description:
          "The customer is actively monitoring messages, failures, and quote follow-up behavior.",
      },
      {
        title: "Expand digital workflows without adding manual overhead",
        description:
          "The account is open to broader automation if setup friction and reliability improve.",
      },
    ],
    gaps: [
      {
        feature: "Messaging",
        reason: "Automations and follow-up messaging are active, but message failures and trigger behavior still need tighter operational control.",
        expectedImpact: "Create a more dependable follow-up engine for quotes, missed calls, and customer status changes.",
      },
      {
        feature: "AI",
        reason: "The account is working through setup and monitoring details but has not fully extended AI coverage into repeated customer workflows.",
        expectedImpact: "Speed up first response and reduce manual handling for common inbound questions.",
      },
      {
        feature: "Payments",
        reason: "Quote and follow-up workflows are improving, but payment collection is still disconnected from the customer conversation layer.",
        expectedImpact: "Move faster from quote approval to cash collection inside the same workflow.",
      },
    ],
  },
  "northfield-electrical": {
    goals: [
      {
        title: "Reduce after-hours leakage and missed-call risk",
        description:
          "The team is reviewing AI and Phones because inbound demand still needs better coverage.",
      },
      {
        title: "Tune AI takeover and response timing",
        description:
          "The customer is actively adjusting AI behavior and how humans step into live conversations.",
      },
      {
        title: "Finish routing and porting work without slowing conversion",
        description:
          "Phone setup details are still active and directly affect the customer experience.",
      },
    ],
    gaps: [
      {
        feature: "AI",
        reason: "AI is active, but response timing and takeover behavior still need tuning before the workflow is trusted at scale.",
        expectedImpact: "Recover more inbound demand with a faster and more controlled first response layer.",
      },
      {
        feature: "Phones",
        reason: "Porting and routing steps are still being worked through, which keeps the phone workflow from being fully operational.",
        expectedImpact: "Tighten missed-call recovery and routing accountability on a high-intent channel.",
      },
      {
        feature: "Payments",
        reason: "Customer communication is active, but invoice and payment follow-up are still happening outside the main workflow.",
        expectedImpact: "Shorten the path from completed work or approval to collected cash.",
      },
    ],
  },
};

function pickUsageRow(accountId: string) {
  const usageRows = loadUsageRows();

  if (accountId === "northfield-electrical") {
    return usageRows.find(
      (row) => String(row.row["ORGANIZATION VERTICAL"]) === "Home Services",
    )?.row;
  }

  if (accountId === "meridian-furniture") {
    return usageRows.find(
      (row) => String(row.row["ORGANIZATION VERTICAL"]) === "Retail",
    )?.row;
  }

  return undefined;
}

function evidenceFromSource(source: NormalizedSource): Evidence {
  const quote = source.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 24);

  return {
    sourceId: source.id,
    sourceType: source.type,
    quote: quote || source.content.slice(0, 180),
  };
}

function buildOfflineFixture(
  accountId: string,
  input: NormalizedAccountInput,
): {
  goals: GoalsResult;
  usage: UsageResult;
  gaps: GapsResult;
  opportunities: OpportunitiesResult;
  narrative: NarrativeResult;
} {
  const template = OFFLINE_FIXTURES[accountId] ?? OFFLINE_FIXTURES.apex;
  const transcriptEvidence = input.transcripts.map(evidenceFromSource);
  const fallbackEvidence = transcriptEvidence[0] ?? {
    sourceId: "usage-1",
    sourceType: "usage" as const,
    quote: input.usageContext.slice(0, 180),
  };
  const usageEvidence: Evidence =
    input.usage && input.sourceMap[input.usage.sourceId]
      ? {
          sourceId: input.usage.sourceId,
          sourceType: "usage",
          quote: input.sourceMap[input.usage.sourceId].content
            .split(/\r?\n/)
            .slice(0, 3)
            .join(" | "),
        }
      : fallbackEvidence;

  const goals: GoalsResult = {
    goals: template.goals.map((goal, index) => ({
      id: `goal-${index + 1}`,
      title: goal.title,
      description: goal.description,
      evidence: [transcriptEvidence[index] ?? fallbackEvidence],
      confidence: 0.84 - index * 0.06,
    })),
  };

  const usage: UsageResult = {
    usage: goals.goals.map((goal, index) => ({
      goalId: goal.id,
      status: index === 0 ? "lagging" : index === 1 ? "partial" : "working",
      metrics: [
        {
          label: "Operational signal",
          value: index === 0 ? "Needs action" : index === 1 ? "Mixed" : "Stable",
          context: input.usage?.vertical || "transcript-only",
        },
      ],
      notes: `Offline fixture assessment for ${goal.title}.`,
      evidence: [usageEvidence],
      confidence: 0.78 - index * 0.04,
    })),
  };

  const gaps: GapsResult = {
    gaps: template.gaps.map((gap, index) => ({
      id: `gap-${index + 1}`,
      goalId: goals.goals[index]?.id ?? goals.goals[0].id,
      feature: gap.feature,
      reason: gap.reason,
      severity: Math.max(3, 5 - index),
      evidence: [transcriptEvidence[index] ?? usageEvidence],
      confidence: 0.83 - index * 0.05,
    })),
  };

  const opportunities: OpportunitiesResult = {
    opportunities: gaps.gaps.map((gap, index) => ({
      id: `opp-${index + 1}`,
      gapId: gap.id,
      feature: gap.feature,
      pitch:
        template.gaps[index]?.pitch ||
        PRODUCT_CATALOG[gap.feature].pitchTemplate,
      expectedImpact: template.gaps[index]?.expectedImpact || PRODUCT_CATALOG[gap.feature].summary,
      score: 0.92 - index * 0.08,
      confidence: 0.82 - index * 0.05,
      evidence: [gap.evidence[0] ?? usageEvidence],
    })),
  };

  const narrative: NarrativeResult = {
    brief: {
      accountName: input.accountName,
      summary: `${input.accountName} shows clear expansion paths across ${opportunities.opportunities
        .map((item) => item.feature)
        .join(", ")} with grounded gaps tied to current workflow friction.`,
      topGaps: gaps.gaps.slice(0, 3).map((gap) => gap.id),
      topOpportunities: opportunities.opportunities.slice(0, 3).map((opportunity) => opportunity.id),
      qbrOutline: {
        goals: goals.goals.map((goal) => goal.title),
        currentPerformance: usage.usage.map((item) => item.notes),
        gaps: gaps.gaps.map((gap) => gap.reason),
        opportunities: opportunities.opportunities.map((item) => item.pitch),
        asks: opportunities.opportunities.map(
          (item) => `Review rollout plan for ${item.feature}.`,
        ),
      },
      deckSlides: [
        {
          title: "Executive summary",
          bullets: [
            `${input.accountName} has grounded expansion motion across three product areas.`,
          ],
        },
        {
          title: "Top gaps",
          bullets: gaps.gaps.map((gap) => `${gap.feature}: ${gap.reason}`),
        },
        {
          title: "Recommended asks",
          bullets: opportunities.opportunities.map(
            (item) => `${item.feature}: ${item.expectedImpact}`,
          ),
        },
      ],
      overallConfidence: 0.79,
    },
  };

  return {
    goals,
    usage,
    gaps,
    opportunities,
    narrative,
  };
}

function createOfflineGenerateObject(
  accountId: string,
  input: NormalizedAccountInput,
): GenerateObjectLike {
  const fixture = buildOfflineFixture(accountId, input);
  let callCount = 0;

  return (async (args: Parameters<GenerateObjectLike>[0]) => {
    callCount += 1;
    const schemaName =
      "schemaName" in args && typeof args.schemaName === "string"
        ? args.schemaName
        : "";

    const object =
      schemaName === "Goals"
        ? fixture.goals
        : schemaName === "Usage"
          ? fixture.usage
          : schemaName === "Gaps"
            ? fixture.gaps
            : schemaName === "Opportunities"
              ? fixture.opportunities
              : schemaName === "Narrative" || schemaName === "Brief"
                ? fixture.narrative
                : null;

    if (!object) {
      throw new Error(`Unsupported schemaName ${schemaName} in offline eval.`);
    }

    const inputTokens = 120 + callCount * 13;
    const outputTokens = 48 + callCount * 9;

    return {
      object,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }) as GenerateObjectLike;
}

async function main() {
  const live = process.argv.includes("--live");
  const transcriptAccounts = await loadTranscriptAccounts();
  const rows: Array<Record<string, string | number>> = [];
  let passed = 0;

  if (live && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("--live requires ANTHROPIC_API_KEY.");
  }

  if (!live) {
    process.env.ANTHROPIC_API_KEY ||= "offline-eval-key";
  }

  for (const account of transcriptAccounts) {
    const input = normalizeAccountInput({
      accountName: account.name,
      transcripts: account.transcripts,
      usageRow: pickUsageRow(account.id),
    });

    try {
      const result = await runPipeline(input, {
        generateObject: live ? undefined : createOfflineGenerateObject(account.id, input),
      });
      const evaluation = evaluatePipelineStructure(result);

      if (evaluation.passed) {
        passed += 1;
      }

      rows.push({
        account: account.name,
        mode: live ? "live" : "mock",
        pass: evaluation.passed ? "PASS" : "FAIL",
        goals: result.goals.goals.length,
        gaps: result.gaps.gaps.length,
        opportunities: result.opportunities.opportunities.length,
        confidence: result.brief.overallConfidence.toFixed(2),
        errors: evaluation.errors.join(" | ") || "-",
      });
    } catch (error) {
      rows.push({
        account: account.name,
        mode: live ? "live" : "mock",
        pass: "FAIL",
        goals: 0,
        gaps: 0,
        opportunities: 0,
        confidence: "n/a",
        errors: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.table(rows);
  console.log(
    `Summary: ${passed}/${transcriptAccounts.length} accounts passed (${live ? "live" : "mock"} mode).`,
  );

  if (passed !== transcriptAccounts.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
