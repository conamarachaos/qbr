"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Sparkles,
  Upload,
} from "lucide-react";

import {
  commitUploadAction,
  previewUploadAction,
  type UploadPreviewProposal,
} from "@/app/(app)/actions";
import { type IngestUploadResult } from "@/lib/repo/accounts";
import { InlineQbrRunner } from "@/components/app/inline-qbr-runner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerText } from "@/components/ui/shimmer-text";

type Step = "select" | "analyzing" | "confirm" | "committing" | "done";

const sourceTypeLabel: Record<string, string> = {
  call: "Call transcript",
  email: "Email thread",
  usage: "Usage data",
};

// Editable per-file decision, seeded from a proposal.
interface Decision extends UploadPreviewProposal {
  accountNameEdited: string;
}

const ANALYZE_MESSAGES = [
  "Reading documents…",
  "Detecting account names…",
  "Classifying source types…",
  "Matching against your portfolio…",
];

export function UploadModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [skipped, setSkipped] = useState<Array<{ filename: string; reason: string }>>([]);
  const [committed, setCommitted] = useState<IngestUploadResult | null>(null);
  const [analyzeMsg, setAnalyzeMsg] = useState(ANALYZE_MESSAGES[0]);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setStep("select");
    setFileNames([]);
    setError(null);
    setDecisions([]);
    setSkipped([]);
    setCommitted(null);
    formRef.current?.reset();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleAnalyze(formData: FormData) {
    setError(null);
    setStep("analyzing");

    // Cycle the animated status text while the server works.
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % ANALYZE_MESSAGES.length;
      setAnalyzeMsg(ANALYZE_MESSAGES[i]);
    }, 1200);

    try {
      const result = await previewUploadAction(formData);
      if (!result.ok) {
        setError(result.error);
        setStep("select");
        return;
      }
      setSkipped(result.skipped);
      setDecisions(
        result.proposals.map((p) => ({
          ...p,
          accountNameEdited: p.matchedAccountName ?? p.proposedAccountName,
        })),
      );
      if (result.proposals.length === 0) {
        setError("No usable files found.");
        setStep("select");
        return;
      }
      setStep("confirm");
    } catch (err) {
      // A thrown/rejected server action (parse failure, network error, timeout)
      // must not leave the modal stuck on the spinner forever.
      setError(err instanceof Error ? err.message : "Failed to analyze files. Please try again.");
      setStep("select");
    } finally {
      clearInterval(interval);
    }
  }

  function handleConfirm() {
    setStep("committing");
    setError(null);
    startTransition(async () => {
      const payload = decisions.map((d) => {
        // If the user edited the name away from the matched account, treat it as
        // a new account; otherwise keep the matched id.
        const keptMatch =
          d.matchedAccountId &&
          d.accountNameEdited.trim() === (d.matchedAccountName ?? "").trim();
        return {
          filename: d.filename,
          content: d.content,
          sourceType: d.sourceType,
          accountId: keptMatch ? d.matchedAccountId : null,
          accountName: d.accountNameEdited.trim() || d.proposedAccountName,
          vertical: d.vertical,
          arrUsd: d.arrUsd,
        };
      });

      const result = await commitUploadAction(payload);
      if (!result.ok) {
        setError(result.error);
        setStep("confirm");
        return;
      }
      setCommitted(result.result);
      setStep("done");
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4" />
          Upload sources
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload sources</DialogTitle>
          <DialogDescription>
            Drop transcripts, emails, or usage files. The agent detects the account, you confirm,
            then optionally run a QBR.
          </DialogDescription>
        </DialogHeader>

        {/* STEP: SELECT */}
        {step === "select" ? (
          <form
            ref={formRef}
            action={(formData) => {
              void handleAnalyze(formData);
            }}
            className="space-y-4"
          >
            <label
              htmlFor="modal-files"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border/70 bg-background/60 p-8 text-center text-sm text-muted-foreground transition hover:border-primary/50"
            >
              <Upload className="h-6 w-6" />
              <span>Click to choose files</span>
              <span className="text-xs">.txt, .vtt, .eml, .csv, .json, .xlsx — ≤ 7.5MB total</span>
            </label>
            <Input
              id="modal-files"
              name="files"
              type="file"
              multiple
              accept=".txt,.vtt,.eml,.csv,.json,.md,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
            />

            {fileNames.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {fileNames.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={fileNames.length === 0} className="w-full">
              <Sparkles className="h-4 w-4" />
              Analyze {fileNames.length || ""} file{fileNames.length === 1 ? "" : "s"}
            </Button>
          </form>
        ) : null}

        {/* STEP: ANALYZING */}
        {step === "analyzing" ? (
          <div className="py-10 text-center">
            <ShimmerText className="text-base font-medium">{analyzeMsg}</ShimmerText>
          </div>
        ) : null}

        {/* STEP: CONFIRM */}
        {step === "confirm" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review where each file will go. Edit an account name to retarget or create a new
              account.
            </p>
            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {decisions.map((d, index) => {
                const isNew =
                  !d.matchedAccountId ||
                  d.accountNameEdited.trim() !== (d.matchedAccountName ?? "").trim();
                return (
                  <div key={d.fileId} className="space-y-2 rounded-3xl border border-border/70 p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{d.filename}</span>
                      <Badge variant="outline">{sourceTypeLabel[d.sourceType] ?? d.sourceType}</Badge>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {Math.round(d.confidence * 100)}%
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`acct-${d.fileId}`} className="text-xs">
                        Account {isNew ? <Badge className="ml-1">New</Badge> : <Badge variant="secondary" className="ml-1">Existing</Badge>}
                      </Label>
                      <Input
                        id={`acct-${d.fileId}`}
                        value={d.accountNameEdited}
                        onChange={(e) =>
                          setDecisions((cur) =>
                            cur.map((item, i) =>
                              i === index ? { ...item, accountNameEdited: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">{d.reasoning}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {skipped.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Skipped: {skipped.map((s) => `${s.filename} (${s.reason})`).join(", ")}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={reset}>
                Start over
              </Button>
              <Button onClick={handleConfirm}>
                Confirm &amp; save {decisions.length} file{decisions.length === 1 ? "" : "s"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* STEP: COMMITTING */}
        {step === "committing" ? (
          <div className="py-10 text-center">
            <ShimmerText className="text-base font-medium">Saving sources…</ShimmerText>
          </div>
        ) : null}

        {/* STEP: DONE */}
        {step === "done" && committed ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Ingested into {committed.accounts.length} account
              {committed.accounts.length === 1 ? "" : "s"}.
            </p>
            <div className="space-y-3">
              {committed.accounts.map((account) => (
                <div
                  key={account.accountId}
                  className="space-y-3 rounded-3xl border border-border/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/accounts/${account.accountId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {account.accountName}
                    </Link>
                    {account.created ? (
                      <Badge>New account</Badge>
                    ) : (
                      <Badge variant="secondary">Existing</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {account.sourceCount} source{account.sourceCount === 1 ? "" : "s"}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/accounts/${account.accountId}`}>Open</Link>
                      </Button>
                      <InlineQbrRunner
                        accountId={account.accountId}
                        accountName={account.accountName}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>
                Upload more
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
