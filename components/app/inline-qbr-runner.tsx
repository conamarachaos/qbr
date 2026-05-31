"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const STAGES = [
  { id: "stage1", name: "Goal extraction" },
  { id: "stage2", name: "Usage analysis" },
  { id: "stage3", name: "Gap detection" },
  { id: "stage4", name: "Opportunity mapping" },
  { id: "stage5", name: "Narrative generation" },
] as const;

type StageStatus = "idle" | "running" | "completed" | "failed";

function parseSseEvent(block: string) {
  const lines = block.split("\n");
  const event = lines.find((l) => l.startsWith("event:"))?.replace("event:", "").trim();
  const dataLine = lines
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.replace("data:", "").trim())
    .join("\n");
  if (!event || !dataLine) return null;
  return { event, data: JSON.parse(dataLine) as Record<string, unknown> };
}

// Compact QBR pipeline runner for use inside the upload modal: streams the same
// /api/accounts/[id]/run SSE the full wizard uses, then routes to the brief.
export function InlineQbrRunner({ accountId, accountName }: { accountId: string; accountName: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Record<string, StageStatus>>(
    Object.fromEntries(STAGES.map((s) => [s.id, "idle"])),
  );

  const completed = Object.values(stages).filter((s) => s === "completed").length;
  const activeStage = STAGES.find((s) => stages[s.id] === "running");

  async function start() {
    setRunning(true);
    setError(null);
    setStages(Object.fromEntries(STAGES.map((s) => [s.id, "idle"])));

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
          setStages((cur) => ({ ...cur, [stageId]: parsed.data.status as StageStatus }));
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

  if (!running && completed === 0 && !error) {
    return (
      <Button size="sm" onClick={start}>
        <Sparkles className="h-4 w-4" />
        Run QBR now
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <Progress value={(completed / STAGES.length) * 100} />
      <p className="text-xs text-muted-foreground">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : completed === STAGES.length ? (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Brief ready — opening…
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            {activeStage ? activeStage.name : "Starting"} · {completed}/{STAGES.length} ({accountName})
          </span>
        )}
      </p>
    </div>
  );
}
