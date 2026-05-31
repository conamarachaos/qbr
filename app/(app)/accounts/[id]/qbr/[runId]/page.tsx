import { notFound } from "next/navigation";

import { BriefReviewPanel } from "@/components/app/brief-review-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { parsePersistedBriefData, getRunDetail } from "@/lib/repo/runs";
import { GapsSchema, GoalsSchema, OpportunitiesSchema, UsageSchema } from "@/lib/schemas";

export default async function QbrReviewPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const user = await requireCurrentUser();
  const { id, runId } = await params;
  const run = await getRunDetail(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    id,
    runId,
  );

  if (!run?.brief || run.status !== "ready") {
    notFound();
  }

  const persisted = parsePersistedBriefData(run.brief.data);
  const goals = GoalsSchema.parse(run.goals).goals;
  const usage = UsageSchema.parse(run.usage).usage;
  const gaps = GapsSchema.parse(run.gaps).gaps;
  const opportunities = OpportunitiesSchema.parse(run.opportunities).opportunities;
  const usageTotals = run.usageTotals as {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
  const stages = run.stages as Array<{
    id: string;
    label: string;
    attempts: number;
    modelId: string;
    usage: { totalTokens: number; inputTokens: number; outputTokens: number };
  }>;

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-3xl">Review persisted brief</CardTitle>
          <CardDescription>
            Edit, approve, and export the saved QBR artifact. Export stays locked until an AM approves the brief.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {run.account.name} · {run.period || "Unspecified period"}
        </CardContent>
      </Card>

      <BriefReviewPanel
        accountId={run.accountId}
        runId={run.id}
        persisted={persisted}
        goals={goals}
        usage={usage}
        gaps={gaps}
        opportunities={opportunities}
        usageTotals={usageTotals}
        stages={stages}
        accountVertical={run.account.vertical}
        approvedAt={run.brief.approvedAt?.toISOString() ?? null}
      />
    </div>
  );
}
