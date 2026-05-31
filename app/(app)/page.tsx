import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  DollarSign,
  FileText,
  HeartPulse,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { getDashboardSummary } from "@/lib/repo/accounts";

function formatDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value)
    : "—";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function healthVariant(category?: string | null) {
  if (category === "healthy") return "default" as const;
  if (category === "at_risk") return "secondary" as const;
  if (category === "critical") return "destructive" as const;
  return "outline" as const;
}

const STAGE_LABELS: Record<string, string> = {
  identified: "Identified",
  qualified: "Qualified",
  proposed: "Proposed",
  won: "Won",
  lost: "Lost",
};

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="font-display text-3xl font-semibold leading-none">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="rounded-2xl bg-primary/10 p-2.5 text-primary">{icon}</span>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const summary = await getDashboardSummary({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  });

  const { totals, health, attention, pipeline, recentRuns, qbrsDue, renewalsDue } = summary;
  const healthDenom =
    health.healthy + health.at_risk + health.critical + health.unknown || 1;
  const healthBars: Array<{ key: keyof typeof health; label: string; cls: string }> = [
    { key: "healthy", label: "Healthy", cls: "bg-emerald-500" },
    { key: "at_risk", label: "At risk", cls: "bg-amber-500" },
    { key: "critical", label: "Critical", cls: "bg-red-500" },
    { key: "unknown", label: "Unscored", cls: "bg-muted-foreground/40" },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between md:space-y-0">
          <div>
            <CardTitle className="font-display text-3xl">Dashboard</CardTitle>
            <CardDescription>
              {user.role === "am"
                ? "Your book of business at a glance — health, renewals, QBRs, and expansion."
                : "Workspace-wide customer health, renewals, QBR activity, and expansion pipeline."}
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/portfolio">
              View portfolio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
      </Card>

      {totals.accounts === 0 ? (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <CardTitle className="text-lg">No accounts yet</CardTitle>
              <CardDescription>
                Add your first customer to start tracking health, renewals, and QBRs.
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/portfolio#new-account">
                <Plus className="h-4 w-4" />
                Add an account
              </Link>
            </Button>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accounts"
          value={String(totals.accounts)}
          hint={`${formatCurrency(totals.arr)} ARR under management`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Avg health"
          value={totals.avgHealth !== null ? String(totals.avgHealth) : "—"}
          hint={`${health.critical} critical · ${health.at_risk} at risk`}
          icon={<HeartPulse className="h-5 w-5" />}
        />
        <StatCard
          label="Needs a QBR"
          value={String(qbrsDue)}
          hint={`${renewalsDue} renewal${renewalsDue === 1 ? "" : "s"} within 45 days`}
          icon={<CalendarClock className="h-5 w-5" />}
        />
        <StatCard
          label="Open expansion"
          value={formatCurrency(pipeline.openValue)}
          hint={`${pipeline.openCount} open · ${formatCurrency(pipeline.wonValue)} won`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Needs attention
              </CardTitle>
              <CardDescription>
                Critical/at-risk health, upcoming renewals, or an overdue QBR.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
                Nothing flagged — every account is healthy and on schedule.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {attention.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/accounts/${account.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {account.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{account.tier.replace("_", " ")}</Badge>
                        {typeof account.arr === "number" ? (
                          <span>{formatCurrency(account.arr)}</span>
                        ) : null}
                        <span>Renewal {formatDate(account.renewalDate)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Badge variant={healthVariant(account.healthCategory)}>
                        {account.health ?? "n/a"}
                      </Badge>
                      {account.qbrDue ? (
                        <Badge variant="destructive">QBR due</Badge>
                      ) : null}
                      {account.renewalSoon ? (
                        <Badge variant="secondary">Renewal soon</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health distribution</CardTitle>
            <CardDescription>Latest score across {healthDenom} account{healthDenom === 1 ? "" : "s"}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {healthBars.map((bar) =>
                health[bar.key] > 0 ? (
                  <div
                    key={bar.key}
                    className={bar.cls}
                    style={{ width: `${(health[bar.key] / healthDenom) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <ul className="space-y-2 text-sm">
              {healthBars.map((bar) => (
                <li key={bar.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${bar.cls}`} />
                    {bar.label}
                  </span>
                  <span className="font-medium">{health[bar.key]}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Expansion pipeline
              </CardTitle>
              <CardDescription>Opportunities seeded from QBR gaps.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/opportunities">Open board</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pipeline.openCount === 0 && (pipeline.byStage.won?.count ?? 0) === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
                No opportunities yet — run a QBR to surface expansion plays.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {["identified", "qualified", "proposed", "won", "lost"].map((stage) => {
                  const bucket = pipeline.byStage[stage];
                  if (!bucket || bucket.count === 0) return null;
                  return (
                    <li
                      key={stage}
                      className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">{STAGE_LABELS[stage] ?? stage}</Badge>
                        <span className="text-muted-foreground">{bucket.count}</span>
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatCurrency(bucket.value)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent QBR activity
            </CardTitle>
            <CardDescription>Latest runs across your accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
                No QBRs run yet. Open an account and generate one.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {recentRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/accounts/${run.accountId}/qbr/${run.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {run.accountName}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.period ? `${run.period} · ` : ""}
                        {formatDate(run.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {run.approved ? (
                        <Badge variant="default">Approved</Badge>
                      ) : (
                        <Badge variant="secondary">{run.status}</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
