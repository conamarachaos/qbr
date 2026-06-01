"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { type GoalDecisionStatus } from "@prisma/client";

import { setGoalDecisionAction } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// One goal as the AM sees it: the customer objective, how confident the AI is
// in it (with the evidence behind the inference), the AM's confirm/dismiss
// decision, the usage signal that proves or disproves progress, and how much
// open work it spawned. Goals + usage are diagnosis — the actionable entities
// (gaps, opportunities) live on their own kanban tabs.
export type AlignmentEvidence = {
  sourceId?: string;
  sourceLabel?: string;
  quote: string;
};

export type AlignmentGoal = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  decision: GoalDecisionStatus;
  evidence: AlignmentEvidence[];
  // null when no usage item references this goal — i.e. we have a stated goal
  // but no signal on whether the customer is making progress. That's exactly
  // the "weak alignment" problem the QBR is meant to surface, so we show it
  // rather than hide it.
  usage: {
    status: "working" | "partial" | "lagging";
    notes: string;
    metrics: { label: string; value: string; context?: string }[];
  } | null;
  gapCount: number;
  opportunityCount: number;
};

const STATUS_META: Record<
  NonNullable<AlignmentGoal["usage"]>["status"],
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  working: { label: "On track", variant: "success" },
  partial: { label: "At risk", variant: "warning" },
  lagging: { label: "Lagging", variant: "destructive" },
};

// Goal inference is the case study's top risk, so the AM needs to see how sure
// the AI is at a glance. High/medium/low rather than a raw 0–1 number.
function confidenceMeta(confidence: number): {
  label: string;
  variant: "secondary" | "warning" | "destructive";
} {
  if (confidence >= 0.75) return { label: "High confidence", variant: "secondary" };
  if (confidence >= 0.5) return { label: "Medium confidence", variant: "warning" };
  return { label: "Low confidence", variant: "destructive" };
}

function GoalRow({
  goal,
  accountId,
  qbrRunId,
}: {
  goal: AlignmentGoal;
  accountId: string;
  qbrRunId: string | null;
}) {
  const status = goal.usage ? STATUS_META[goal.usage.status] : null;
  const confidence = confidenceMeta(goal.confidence);
  // Optimistic decision so the chip/buttons react instantly; revalidation from
  // the server action then makes it authoritative.
  const [decision, setDecision] = useState<GoalDecisionStatus>(goal.decision);
  const [pending, startTransition] = useTransition();

  function decide(next: GoalDecisionStatus) {
    if (!qbrRunId || pending) return;
    const previous = decision;
    // Toggle off if the AM clicks the active state again.
    const target = decision === next ? "pending" : next;
    setDecision(target);
    startTransition(async () => {
      try {
        await setGoalDecisionAction({ accountId, qbrRunId, goalId: goal.id, status: target });
      } catch {
        setDecision(previous);
      }
    });
  }

  return (
    <div
      className={`rounded-3xl border border-border/70 p-4 ${
        decision === "dismissed" ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium leading-snug">{goal.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{goal.description}</p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
          {decision === "confirmed" ? (
            <Badge variant="success">Confirmed</Badge>
          ) : decision === "dismissed" ? (
            <Badge variant="destructive">Dismissed</Badge>
          ) : null}
          {status ? (
            <Badge variant={status.variant}>{status.label}</Badge>
          ) : (
            <Badge variant="secondary">No signal</Badge>
          )}
          <Badge variant={confidence.variant}>{confidence.label}</Badge>
        </div>
      </div>

      {goal.usage ? (
        <div className="mt-3 space-y-2">
          {goal.usage.metrics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {goal.usage.metrics.map((metric, index) => (
                <Badge key={`${metric.label}-${index}`} variant="outline">
                  {metric.label}: {metric.value}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">{goal.usage.notes}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No usage data ties to this goal yet — verify the goal or capture the relevant signal.
        </p>
      )}

      {goal.evidence.length > 0 ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Why this goal? ({goal.evidence.length}{" "}
            {goal.evidence.length === 1 ? "source" : "sources"})
          </summary>
          <ul className="mt-2 space-y-2">
            {goal.evidence.map((item, index) => (
              <li
                key={`${item.sourceId ?? "src"}-${index}`}
                className="rounded-2xl bg-muted/60 p-3"
              >
                <p className="italic text-foreground/85">&ldquo;{item.quote}&rdquo;</p>
                {item.sourceLabel ? (
                  <div className="mt-1 text-muted-foreground">— {item.sourceLabel}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs">
          {goal.gapCount > 0 ? (
            <Link href="#gaps" className="text-muted-foreground underline-offset-2 hover:underline">
              {goal.gapCount} open {goal.gapCount === 1 ? "gap" : "gaps"} →
            </Link>
          ) : null}
          {goal.opportunityCount > 0 ? (
            <Link
              href="#opportunities"
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              {goal.opportunityCount} open{" "}
              {goal.opportunityCount === 1 ? "opportunity" : "opportunities"} →
            </Link>
          ) : null}
        </div>
        {qbrRunId ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={decision === "confirmed" ? "default" : "outline"}
              disabled={pending}
              onClick={() => decide("confirmed")}
              className="h-7 px-2 text-xs"
            >
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={decision === "dismissed" ? "destructive" : "outline"}
              disabled={pending}
              onClick={() => decide("dismissed")}
              className="h-7 px-2 text-xs"
            >
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AlignmentPanel({
  goals,
  accountId,
  qbrRunId,
}: {
  goals: AlignmentGoal[];
  accountId: string;
  qbrRunId: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals &amp; usage alignment</CardTitle>
        <CardDescription>
          Each stated customer goal mapped to the usage signal behind it. Confirm or dismiss goals
          the AI inferred; gap and opportunity counts are live open work, managed in the Gaps and
          Opportunities tabs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No goals extracted yet. Generate a QBR to map goals against product usage.
          </p>
        ) : (
          goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} accountId={accountId} qbrRunId={qbrRunId} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
