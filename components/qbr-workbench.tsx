"use client";

import { useMemo, useState } from "react";
import { Database, FileUp, Sparkles } from "lucide-react";

import { BriefView } from "@/components/brief-view";
import { StageProgress, type StageState } from "@/components/stage-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type EditableBrief } from "@/lib/brief-export";
import { type TranscriptAccountOption, type UsageRowOption } from "@/lib/dataset";
import { type Brief, type Gap, type Goal, type Opportunity, type UsageItem } from "@/lib/schemas";

type RunResult = {
  brief: Brief;
  goals: { goals: Goal[] };
  usage: { usage: UsageItem[] };
  gaps: { gaps: Gap[] };
  opportunities: { opportunities: Opportunity[] };
  input: {
    sourceMap: Record<string, { label: string; content: string; type: string }>;
    usage?: {
      vertical?: string;
    };
  };
  usageTotals: { totalTokens: number; inputTokens: number; outputTokens: number };
  stages: Array<{
    id: string;
    label: string;
    attempts: number;
    modelId: string;
    usage: { totalTokens: number; inputTokens: number; outputTokens: number };
  }>;
};

const INITIAL_STAGE_STATE: Record<string, StageState> = {
  stage1: { status: "idle" },
  stage2: { status: "idle" },
  stage3: { status: "idle" },
  stage4: { status: "idle" },
  stage5: { status: "idle" },
};

async function readFilesAsSources<T extends "call" | "email">(
  files: FileList,
  type: T,
): Promise<Array<{ id: string; label: string; type: T; content: string }>> {
  const reads = Array.from(files).map(async (file, index) => ({
    id: `${type}-upload-${index + 1}`,
    label: file.name,
    type,
    content: await file.text(),
  }));

  return Promise.all(reads);
}

async function readSingleFile(files: FileList) {
  const [file] = Array.from(files);
  return file ? file.text() : "";
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

  return {
    event,
    data: JSON.parse(dataLine),
  };
}

export function QbrWorkbench({
  transcriptAccounts,
  usageOptions,
}: {
  transcriptAccounts: TranscriptAccountOption[];
  usageOptions: UsageRowOption[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    transcriptAccounts[0]?.id ?? "",
  );
  const [selectedUsageId, setSelectedUsageId] = useState<string>("none");
  const [manualTranscriptText, setManualTranscriptText] = useState("");
  const [manualEmailText, setManualEmailText] = useState("");
  const [manualUsageText, setManualUsageText] = useState("");
  const [uploadedTranscripts, setUploadedTranscripts] = useState<
    Array<{ id: string; label: string; type: "call"; content: string }>
  >([]);
  const [uploadedEmails, setUploadedEmails] = useState<
    Array<{ id: string; label: string; type: "email"; content: string }>
  >([]);
  const [stageStates, setStageStates] =
    useState<Record<string, StageState>>(INITIAL_STAGE_STATE);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<"pptx" | "pdf" | null>(null);

  const selectedAccount = useMemo(
    () => transcriptAccounts.find((account) => account.id === selectedAccountId),
    [selectedAccountId, transcriptAccounts],
  );

  const selectedUsage = useMemo(
    () => usageOptions.find((option) => option.id === selectedUsageId),
    [selectedUsageId, usageOptions],
  );

  const combinedTranscriptPreview = useMemo(() => {
    const sections = selectedAccount?.transcripts.map(
      (transcript) => `### ${transcript.label}\n\n${transcript.content}`,
    );
    return sections?.join("\n\n====\n\n") || "";
  }, [selectedAccount]);

  async function runPipeline() {
    if (!selectedAccount && !manualTranscriptText.trim() && uploadedTranscripts.length === 0) {
      setError("Select a transcript account or add transcript text before running.");
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    setStageStates(INITIAL_STAGE_STATE);

    const transcripts = [
      ...(selectedAccount?.transcripts ?? []),
      ...uploadedTranscripts,
      ...(manualTranscriptText.trim()
        ? [
            {
              id: "call-manual-1",
              label: "Manual transcript input",
              type: "call" as const,
              content: manualTranscriptText.trim(),
            },
          ]
        : []),
    ];

    const emails = [
      ...uploadedEmails,
      ...(manualEmailText.trim()
        ? [
            {
              id: "email-manual-1",
              label: "Manual email input",
              type: "email" as const,
              content: manualEmailText.trim(),
            },
          ]
        : []),
    ];

    const response = await fetch("/api/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountName: selectedAccount?.name || "Manual account",
        transcripts,
        emails,
        usageRow: selectedUsageId === "none" ? null : selectedUsage?.row,
        usageText: manualUsageText.trim() || undefined,
      }),
    });

    if (!response.ok || !response.body) {
      setRunning(false);
      setError("Failed to start the pipeline.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const parsed = parseSseEvent(part);
        if (!parsed) {
          continue;
        }

        if (parsed.event === "progress") {
          setStageStates((current) => ({
            ...current,
            [parsed.data.stage]: {
              status: parsed.data.status,
              attempts: parsed.data.attempts,
              usage: parsed.data.usage
                ? { totalTokens: parsed.data.usage.totalTokens }
                : undefined,
              message: parsed.data.message,
            },
          }));
        }

        if (parsed.event === "result") {
          setResult(parsed.data as RunResult);
          setRunning(false);
        }

        if (parsed.event === "error") {
          setError(parsed.data.message);
          setRunning(false);
          setStageStates((current) => {
            const next = { ...current };
            const runningStage = Object.keys(next).find(
              (key) => next[key]?.status === "running",
            );
            if (runningStage) {
              next[runningStage] = {
                ...next[runningStage],
                status: "failed",
              };
            }
            return next;
          });
        }
      }
    }

    setRunning(false);
  }

  async function downloadArtifact(format: "pptx" | "pdf", editedBrief: EditableBrief) {
    if (!result) {
      return;
    }

    setDownloadFormat(format);
    try {
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brief: result.brief,
          goals: result.goals.goals,
          usage: result.usage.usage,
          gaps: result.gaps.gaps,
          opportunities: result.opportunities.opportunities,
          editedBrief,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to export ${format.toUpperCase()}.`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.brief.accountName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : `Failed to export ${format.toUpperCase()}.`,
      );
    } finally {
      setDownloadFormat(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8 lg:py-12">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Badge className="rounded-full px-3 py-1 text-sm">
            AI Account Review & Expansion Agent
          </Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
            QBR briefs with cited claims, scored confidence, and a PPTX deck.
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-foreground/75">
            Select a real transcript account from the repo, optionally attach one of the
            anonymized usage rows, and run the five-stage grounded pipeline. No auto-join
            is assumed between transcript names and usage names.
          </p>
        </div>
        <Card className="border-primary/15 bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Grounding guardrails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/80">
            <p>Every goal, gap, and opportunity needs exact evidence or it is dropped.</p>
            <p>Usage and email inputs are optional. Transcript-only runs remain valid.</p>
            <p>Upsells are constrained to the product catalog: Reviews, Webchat, Messaging, Payments, Phones, and AI.</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="input">
        <TabsList>
          <TabsTrigger value="input">Input workspace</TabsTrigger>
          <TabsTrigger value="dataset">Dataset notes</TabsTrigger>
          <TabsTrigger value="results" disabled={!result}>
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Dataset-backed account selection
                </CardTitle>
                <CardDescription>
                  Transcript account and usage row are selected independently. The
                  anonymized dataset does not provide a safe join key.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Transcript account</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick transcript account" />
                    </SelectTrigger>
                    <SelectContent>
                      {transcriptAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.transcriptCount} transcripts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Optional usage row</Label>
                  <Select value={selectedUsageId} onValueChange={setSelectedUsageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick usage row" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No usage row</SelectItem>
                      {usageOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUsage ? (
                    <p className="text-xs text-muted-foreground">{selectedUsage.summary}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Selected transcript preview</Label>
                  <Textarea
                    value={combinedTranscriptPreview}
                    readOnly
                    className="min-h-[280px] bg-muted/40"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optional manual additions</CardTitle>
                <CardDescription>
                  Paste or upload extra call text, email threads, or a usage JSON/CSV
                  snippet. These sources are appended to the selected dataset inputs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Additional call transcripts</Label>
                  <Textarea
                    value={manualTranscriptText}
                    onChange={(event) => setManualTranscriptText(event.target.value)}
                    placeholder="Paste extra transcript text here."
                  />
                  <Input
                    type="file"
                    multiple
                    accept=".txt,.vtt,.md"
                    onChange={async (event) => {
                      if (!event.target.files?.length) {
                        return;
                      }
                      setUploadedTranscripts(
                        await readFilesAsSources(event.target.files, "call"),
                      );
                    }}
                  />
                  {uploadedTranscripts.length ? (
                    <p className="text-xs text-muted-foreground">
                      <FileUp className="mr-1 inline h-3 w-3" />
                      {uploadedTranscripts.length} uploaded transcript file(s)
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Optional email threads</Label>
                  <Textarea
                    value={manualEmailText}
                    onChange={(event) => setManualEmailText(event.target.value)}
                    placeholder="Paste email threads or notes here."
                  />
                  <Input
                    type="file"
                    multiple
                    accept=".txt,.eml,.md"
                    onChange={async (event) => {
                      if (!event.target.files?.length) {
                        return;
                      }
                      setUploadedEmails(await readFilesAsSources(event.target.files, "email"));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Optional usage JSON / CSV</Label>
                  <Textarea
                    value={manualUsageText}
                    onChange={(event) => setManualUsageText(event.target.value)}
                    placeholder='Paste a JSON object/array or CSV header + row here if you are not using the built-in usage row.'
                  />
                  <Input
                    type="file"
                    accept=".json,.csv,.txt"
                    onChange={async (event) => {
                      if (!event.target.files?.length) {
                        return;
                      }
                      setManualUsageText(await readSingleFile(event.target.files));
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runPipeline} disabled={running}>
              {running ? "Running pipeline..." : "Run QBR pipeline"}
            </Button>
            <Badge variant="outline">
              transcript-only runs supported
            </Badge>
            <Badge variant="outline">usage optional</Badge>
            <Badge variant="outline">email optional</Badge>
          </div>

          <StageProgress stages={stageStates} />
          {error ? (
            <Card className="border-destructive/30">
              <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="dataset">
          <Card>
            <CardHeader>
              <CardTitle>Primary dataset manifest</CardTitle>
              <CardDescription>
                Real transcripts live under <code>data/transcripts</code>; usage rows live in{" "}
                <code>data/usage/customer-data-extract.json</code>. The synthetic Acme Dental
                file remains a test fixture only.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {transcriptAccounts.map((account) => (
                <div key={account.id} className="rounded-3xl bg-muted/60 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium">{account.name}</h3>
                    <Badge variant="secondary">{account.transcriptCount} calls</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {account.transcripts.map((item) => item.label).join(", ")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          {result ? (
            <BriefView
              brief={result.brief}
              goals={result.goals.goals}
              usage={result.usage.usage}
              gaps={result.gaps.gaps}
              opportunities={result.opportunities.opportunities}
              sourceMap={result.input.sourceMap}
              accountVertical={result.input.usage?.vertical}
              usageTotals={result.usageTotals}
              stages={result.stages}
              onDownload={downloadArtifact}
              downloadFormat={downloadFormat}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
