import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionItemBoard, type BoardActionItem } from "@/app/(app)/accounts/[id]/action-item-board";
import { AlignmentPanel, type AlignmentGoal } from "@/app/(app)/accounts/[id]/alignment-panel";
import { HashTabs } from "@/app/(app)/accounts/[id]/hash-tabs";
import { GapBoard, type BoardGap } from "@/app/(app)/gaps/gap-board";
import { OpportunityBoard, type BoardOpportunity } from "@/app/(app)/opportunities/opportunity-board";
import { AccountChat } from "@/components/app/account-chat";
import { AccountSettings } from "@/components/app/account-settings";
import { SourceIngestForm } from "@/components/app/source-ingest-form";
import { SourceTimeline, type TimelineSourceSummary } from "@/components/app/source-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rollUpGoalWork } from "@/lib/alignment";
import { requireCurrentUser } from "@/lib/auth/session";
import { getAccountDetail } from "@/lib/repo/accounts";
import { getChatHistory } from "@/lib/repo/chat";
import { parsePersistedBriefData } from "@/lib/repo/runs";
import { GapsSchema, GoalsSchema, OpportunitiesSchema, UsageSchema } from "@/lib/schemas";

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value) : "Not set";
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const account = await getAccountDetail(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    id,
  );

  if (!account) {
    notFound();
  }

  const sessionContext = {
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  };
  const chatHistory = await getChatHistory(sessionContext, account.id);

  const latestHealth = account.healthScores[0] ?? null;
  const latestRun = account.qbrRuns.find((run) => run.status === "ready") ?? null;
  const latestBrief = latestRun?.brief ? parsePersistedBriefData(latestRun.brief.data) : null;

  // Map gap/opportunity ids to human-readable labels so the overview shows
  // titles + a short blurb instead of bare ids like "gap-010".
  const formatFeature = (feature: string) =>
    feature.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const truncate = (text: string, max = 110) =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  // Parse the latest run's structured stages once, then derive every view from
  // it: brief blurb lookups, the gaps/opps boards' labels, and the goal↔usage
  // alignment join below.
  const runGoals = latestRun ? GoalsSchema.parse(latestRun.goals).goals : [];
  const runUsage = latestRun ? UsageSchema.parse(latestRun.usage).usage : [];
  const runGaps = latestRun ? GapsSchema.parse(latestRun.gaps).gaps : [];
  const runOpps = latestRun ? OpportunitiesSchema.parse(latestRun.opportunities).opportunities : [];

  const gapById = new Map(
    runGaps.map((gap) => [gap.id, { title: formatFeature(gap.feature), blurb: gap.reason }]),
  );
  const oppById = new Map(
    runOpps.map((opp) => [opp.id, { title: formatFeature(opp.feature), blurb: opp.pitch }]),
  );
  const briefHref = latestRun ? `/accounts/${account.id}/qbr/${latestRun.id}` : null;

  // Reuse the workspace Opportunities board (drag-and-drop + filter) scoped to
  // this account. The board needs a nested `account` object; every opportunity
  // here belongs to this account, so we stitch it from the account record.
  const boardOpportunities: BoardOpportunity[] = account.opportunities.map((opportunity) => ({
    id: opportunity.id,
    accountId: opportunity.accountId,
    stage: opportunity.stage,
    feature: opportunity.feature,
    title: opportunity.title,
    pitch: opportunity.pitch,
    expectedImpact: opportunity.expectedImpact,
    score: opportunity.score,
    account: {
      id: account.id,
      name: account.name,
      tier: account.tier,
    },
  }));

  // Same pattern as opportunities: the workspace Gaps board needs a nested
  // `account`, and every gap here belongs to this account.
  const boardGaps: BoardGap[] = account.gaps.map((gap) => ({
    id: gap.id,
    accountId: gap.accountId,
    status: gap.status,
    feature: gap.feature,
    reason: gap.reason,
    severity: gap.severity,
    account: {
      id: account.id,
      name: account.name,
      tier: account.tier,
    },
  }));

  // Join usage to goals by goalId and count the gaps/opportunities each goal
  // spawned — gaps carry goalId, opportunities carry gapId, so opps roll up via
  // their gap. Goals/usage have no DB table or lifecycle, so this is read-only.
  const usageByGoal = new Map(runUsage.map((item) => [item.goalId, item]));
  // Live counts of *open* work per goal, read from the DB rows the kanban
  // boards mutate (not the run JSON) — so dismissing a gap or losing an opp
  // drops the goal's count. Rows persisted before goalId existed have it null
  // and simply don't roll up; that's why the panel labels the totals as live.
  const workByGoal = rollUpGoalWork(account.gaps, account.opportunities);

  // The AM's confirm/dismiss decision per goal lives on the latest run.
  const decisionByGoal = new Map(
    (latestRun?.goalDecisions ?? []).map((decision) => [decision.goalId, decision.status]),
  );

  // Resolve evidence sourceIds to human labels so "Why this goal?" cites the
  // call/email by name instead of a bare id.
  const sourceLabelById = new Map(account.sources.map((source) => [source.id, source.label]));

  const alignmentGoals: AlignmentGoal[] = runGoals.map((goal) => {
    const usage = usageByGoal.get(goal.id) ?? null;
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      confidence: goal.confidence,
      decision: decisionByGoal.get(goal.id) ?? "pending",
      evidence: goal.evidence.map((item) => ({
        sourceId: item.sourceId,
        sourceLabel: sourceLabelById.get(item.sourceId),
        quote: item.quote,
      })),
      usage: usage
        ? { status: usage.status, notes: usage.notes, metrics: usage.metrics }
        : null,
      gapCount: workByGoal.get(goal.id)?.gapCount ?? 0,
      opportunityCount: workByGoal.get(goal.id)?.opportunityCount ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between md:space-y-0">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{account.tier.replace("_", " ")}</Badge>
              <Badge variant="secondary">{account.lifecycle}</Badge>
              {latestHealth ? <Badge>{latestHealth.overall} health</Badge> : null}
            </div>
            <div>
              <CardTitle className="font-display text-3xl">{account.name}</CardTitle>
              <CardDescription>
                ARR {typeof account.arr === "number" ? `$${account.arr.toLocaleString()}` : "n/a"}
                {" · "}
                Renewal {formatDate(account.renewalDate)}
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Owners: {account.ownerships.map((ownership) => ownership.user.name || ownership.user.email).join(", ")}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={`/accounts/${account.id}/qbr/new`}>Generate QBR</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <AccountSettings
        account={{
          id: account.id,
          name: account.name,
          vertical: account.vertical,
          tier: account.tier,
          arr: account.arr,
          renewalDate: account.renewalDate,
          lifecycle: account.lifecycle,
        }}
      />

      <HashTabs
        defaultValue="overview"
        validValues={["overview", "sources", "gaps", "opportunities", "qbrs", "action-plan", "ask"]}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="gaps">Gaps</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="qbrs">QBRs</TabsTrigger>
          <TabsTrigger value="action-plan">Action plan</TabsTrigger>
          <TabsTrigger value="ask">Ask</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Latest brief summary</CardTitle>
              </CardHeader>
              <CardContent>
                {latestBrief ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-7 text-foreground/85">{latestBrief.brief.summary}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-3xl bg-muted/60 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Top gaps</div>
                        <ul className="mt-3 space-y-3 text-sm">
                          {latestBrief.brief.topGaps.map((gapId) => {
                            const gap = gapById.get(gapId);
                            return (
                              <li key={gapId}>
                                <div className="font-medium">{gap?.title ?? gapId}</div>
                                {gap?.blurb ? (
                                  <p className="text-xs text-muted-foreground">{truncate(gap.blurb)}</p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="rounded-3xl bg-muted/60 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Top opportunities</div>
                        <ul className="mt-3 space-y-3 text-sm">
                          {latestBrief.brief.topOpportunities.map((opportunityId) => {
                            const opp = oppById.get(opportunityId);
                            return (
                              <li key={opportunityId}>
                                <div className="font-medium">{opp?.title ?? opportunityId}</div>
                                {opp?.blurb ? (
                                  <p className="text-xs text-muted-foreground">{truncate(opp.blurb)}</p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                    {briefHref ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={briefHref}>View full brief →</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No persisted QBR yet. Run the existing five-stage pipeline to populate the account narrative.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Health trend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {account.healthScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No health history yet.</p>
                ) : (
                  account.healthScores.slice(0, 5).map((score) => (
                    <div key={score.id} className="rounded-3xl border border-border/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{score.overall} / 100</div>
                        <Badge variant="outline">{score.category.replace("_", " ")}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{formatDate(score.asOf)}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <AlignmentPanel
            goals={alignmentGoals}
            accountId={account.id}
            qbrRunId={latestRun?.id ?? null}
          />
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <SourceIngestForm accountId={account.id} />
          <Card>
            <CardHeader>
              <CardTitle>Source timeline</CardTitle>
              <CardDescription>
                Calls, emails, and usage in the order they arrived. Expand an artifact for detail,
                or ask the AI about it directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SourceTimeline
                accountId={account.id}
                sources={account.sources.map((source) => ({
                  id: source.id,
                  label: source.label,
                  type: source.type,
                  content: source.content,
                  createdAt: source.createdAt.toISOString(),
                  summary: (source.summary as TimelineSourceSummary | null) ?? null,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps">
          {boardGaps.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No adoption gaps yet. Generate a QBR to surface underused features tied to goals.
              </CardContent>
            </Card>
          ) : (
            <GapBoard gaps={boardGaps} showAccountFilter={false} />
          )}
        </TabsContent>

        <TabsContent value="opportunities">
          {boardOpportunities.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No opportunities yet. Generate a QBR to surface expansion opportunities.
              </CardContent>
            </Card>
          ) : (
            <OpportunityBoard opportunities={boardOpportunities} showAccountFilter={false} />
          )}
        </TabsContent>

        <TabsContent value="qbrs">
          <Card>
            <CardHeader>
              <CardTitle>Run history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {account.qbrRuns.map((run) => (
                <div key={run.id} className="rounded-3xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{run.period || "Unspecified period"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDate(run.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={run.status === "ready" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                        {run.status}
                      </Badge>
                      {run.status === "ready" ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/accounts/${account.id}/qbr/${run.id}`}>Open review</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {run.error ? <p className="mt-3 text-sm text-destructive">{run.error}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="action-plan">
          <ActionItemBoard
            accountId={account.id}
            qbrRunId={latestRun?.id ?? undefined}
            actionItems={account.actionItems.map<BoardActionItem>((item) => ({
              id: item.id,
              accountId: account.id,
              title: item.title,
              status: item.status,
              ownerId: item.ownerId,
              dueDate: item.dueDate ? item.dueDate.toISOString() : null,
            }))}
          />
        </TabsContent>

        <TabsContent value="ask">
          <AccountChat
            accountId={account.id}
            initialMessages={chatHistory.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              citations: message.citations,
            }))}
            sources={account.sources.map((source) => ({
              id: source.id,
              label: source.label,
              type: source.type,
            }))}
          />
        </TabsContent>
      </HashTabs>
    </div>
  );
}
