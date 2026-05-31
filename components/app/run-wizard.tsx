"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  FileText,
  LoaderCircle,
  Mail,
  Phone,
  Sparkles,
  Table2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Stage names + purposes mirror the case-study System Design pipeline exactly.
const STAGES = [
  {
    id: "stage1",
    name: "Goal Extraction",
    purpose: "Identify customer objectives from transcripts and emails.",
  },
  {
    id: "stage2",
    name: "Usage Analysis",
    purpose: "Compare actual usage vs. expected behavior for each goal.",
  },
  {
    id: "stage3",
    name: "Gap Detection",
    purpose: "Highlight underused features tied to goals (“free value”).",
  },
  {
    id: "stage4",
    name: "Opportunity Mapping",
    purpose: "Suggest expansions based on gaps + signals.",
  },
  {
    id: "stage5",
    name: "Narrative Generation",
    purpose: "Produce the QBR-ready brief and customer-facing deck.",
  },
] as const;

type StageStatus = "idle" | "running" | "completed" | "failed";

interface StageState {
  status: StageStatus;
  attempts?: number;
  tokens?: number;
  message?: string;
}

function parseSseEvent(block: string) {
  const lines = block.split("\n");
  const event = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
  const dataLine = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace("data:", "").trim())
    .join("\n");

  if (!event || !dataLine) {
    return null;
  }

  return { event, data: JSON.parse(dataLine) as Record<string, unknown> };
}

const INITIAL: Record<string, StageState> = Object.fromEntries(
  STAGES.map((stage) => [stage.id, { status: "idle" as StageStatus }]),
);

export function RunWizard({
  accountId,
  inputs,
}: {
  accountId: string;
  inputs: { calls: number; emails: number; usage: number };
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Record<string, StageState>>(INITIAL);

  const hasSignals = inputs.calls + inputs.emails + inputs.usage > 0;
  const completedCount = Object.values(stages).filter((s) => s.status === "completed").length;
  const activeIndex = STAGES.findIndex((s) => stages[s.id]?.status === "running");

  async function startRun() {
    setRunning(true);
    setStarted(true);
    setError(null);
    setStages(INITIAL);

    const response = await fetch(`/api/accounts/${accountId}/run`, { method: "POST" });

    if (!response.ok || !response.body) {
      setRunning(false);
      setError("Failed to start the QBR run.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const parsed = parseSseEvent(part);
        if (!parsed) continue;

        if (parsed.event === "progress") {
          const stageId = parsed.data.stage as string;
          setStages((current) => ({
            ...current,
            [stageId]: {
              status: parsed.data.status as StageStatus,
              attempts: parsed.data.attempts as number | undefined,
              tokens: (parsed.data.usage as { totalTokens?: number } | undefined)?.totalTokens,
              message: parsed.data.message as string | undefined,
            },
          }));
        }

        if (parsed.event === "result") {
          const runId = parsed.data.runId as string;
          router.push(`/accounts/${accountId}/qbr/${runId}`);
          router.refresh();
          return;
        }

        if (parsed.event === "error") {
          setError((parsed.data.message as string) ?? "The QBR run failed.");
        }
      }
    }

    setRunning(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              QBR pipeline
            </CardTitle>
            <Badge variant="secondary">{completedCount}/{STAGES.length} stages</Badge>
          </div>
          <Progress value={(completedCount / STAGES.length) * 100} />
          <CardDescription>
            Five prompt-chained stages turn fragmented signals into a grounded, cited account
            narrative. Each stage feeds the next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-1">
            {STAGES.map((stage, index) => {
              const state = stages[stage.id] ?? { status: "idle" as StageStatus };
              const isRunning = state.status === "running";
              const isDone = state.status === "completed";
              const isFailed = state.status === "failed";
              const isActive = isRunning || (started && index === activeIndex);

              return (
                <li
                  key={stage.id}
                  className={`flex gap-4 rounded-2xl border p-4 transition-colors ${
                    isActive
                      ? "border-primary/40 bg-primary/5"
                      : isDone
                        ? "border-border/60 bg-background"
                        : "border-border/60 bg-background/60"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isRunning ? (
                      <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : isFailed ? (
                      <Circle className="h-5 w-5 text-destructive" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{stage.name}</span>
                      {isDone ? <Badge variant="default">done</Badge> : null}
                      {isRunning ? <Badge variant="secondary">running</Badge> : null}
                      {isFailed ? <Badge variant="destructive">failed</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {state.message ?? stage.purpose}
                    </p>
                    {state.tokens ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {state.tokens.toLocaleString()} tokens
                        {state.attempts && state.attempts > 1 ? ` · ${state.attempts} attempts` : ""}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>

          {error ? (
            <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inputs</CardTitle>
            <CardDescription>Sources this run will reason over.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-2.5">
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Call transcripts
              </span>
              <Badge variant="outline">{inputs.calls}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-2.5">
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email threads
              </span>
              <Badge variant="outline">{inputs.emails}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-2.5">
              <span className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-muted-foreground" />
                Usage snapshots
              </span>
              <Badge variant="outline">{inputs.usage}</Badge>
            </div>

            {!hasSignals ? (
              <p className="text-xs text-destructive">
                No sources yet. Add transcripts, emails, or usage on the account&rsquo;s Sources tab
                before running.
              </p>
            ) : null}

            <Button onClick={startRun} disabled={running || !hasSignals} className="w-full">
              {running ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Running pipeline&hellip;
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate QBR
                </>
              )}
            </Button>
            {running ? (
              <p className="text-center text-xs text-muted-foreground">
                You&rsquo;ll land on the cited brief automatically when it finishes.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Grounding guardrails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
            <p>Every goal, gap, and opportunity carries an evidence quote + confidence score.</p>
            <p>Upsells must map to a real product feature and a detected gap.</p>
            <p>Low-confidence claims are flagged so AMs can review before sending.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
