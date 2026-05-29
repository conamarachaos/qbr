"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const STAGE_LABELS: Record<string, string> = {
  stage1: "Goal extraction",
  stage2: "Usage analysis",
  stage3: "Gap detection",
  stage4: "Opportunity mapping",
  stage5: "Narrative generation",
};

export interface StageState {
  status: "idle" | "running" | "completed" | "failed";
  attempts?: number;
  usage?: {
    totalTokens: number;
  };
  message?: string;
}

export function StageProgress({
  stages,
}: {
  stages: Record<string, StageState>;
}) {
  const completed = Object.values(stages).filter(
    (stage) => stage.status === "completed",
  ).length;
  const total = Object.keys(STAGE_LABELS).length;

  return (
    <Card className="border-primary/15 bg-card/90 backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Pipeline progress</CardTitle>
          <Badge variant="secondary">
            {completed}/{total} complete
          </Badge>
        </div>
        <Progress value={(completed / total) * 100} />
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Object.entries(STAGE_LABELS).map(([id, label]) => {
          const stage = stages[id] || { status: "idle" as const };
          const isRunning = stage.status === "running";
          const isCompleted = stage.status === "completed";
          const isFailed = stage.status === "failed";

          return (
            <div
              key={id}
              className="rounded-3xl border border-border/80 bg-background/70 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{label}</span>
                {isRunning ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : null}
              </div>
              <Badge
                variant={
                  isFailed ? "destructive" : isCompleted ? "default" : "outline"
                }
              >
                {stage.status}
              </Badge>
              {stage.message ? (
                <p className="mt-2 text-xs text-muted-foreground">{stage.message}</p>
              ) : null}
              {stage.attempts ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  attempts: {stage.attempts}
                  {stage.usage?.totalTokens
                    ? ` · ${stage.usage.totalTokens.toLocaleString()} tokens`
                    : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
