"use client";

import { useState } from "react";

import { BriefView } from "@/components/brief-view";
import { type EditableBrief } from "@/lib/brief-export";
import { type PersistedBriefData } from "@/lib/persisted-brief";
import {
  type Brief,
  type Gap,
  type Goal,
  type Opportunity,
  type UsageItem,
} from "@/lib/schemas";

export function BriefReviewPanel({
  accountId,
  runId,
  persisted,
  goals,
  usage,
  gaps,
  opportunities,
  usageTotals,
  stages,
  accountVertical,
  approvedAt,
}: {
  accountId: string;
  runId: string;
  persisted: PersistedBriefData;
  goals: Goal[];
  usage: UsageItem[];
  gaps: Gap[];
  opportunities: Opportunity[];
  usageTotals: { totalTokens: number; inputTokens: number; outputTokens: number };
  stages: Array<{
    id: string;
    label: string;
    attempts: number;
    modelId: string;
    usage: { totalTokens: number; inputTokens: number; outputTokens: number };
  }>;
  accountVertical?: string | null;
  approvedAt?: string | null;
}) {
  const [downloadFormat, setDownloadFormat] = useState<"pptx" | "pdf" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [approvedState, setApprovedState] = useState<string | null>(approvedAt ?? null);
  const [message, setMessage] = useState<string | null>(null);

  async function persistBrief(editedBrief: EditableBrief, approve = false) {
    setSaveState("saving");
    setMessage(null);

    const response = await fetch(`/api/accounts/${accountId}/qbr/${runId}/brief`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        editedBrief,
        approve,
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      setMessage("Failed to save brief edits.");
      return;
    }

    setSaveState("saved");
    if (approve) {
      setApprovedState(new Date().toISOString());
      setMessage("Brief approved. Exports are now unlocked.");
    } else {
      setMessage("Brief saved.");
    }
  }

  async function downloadArtifact(format: "pptx" | "pdf", editedBrief: EditableBrief) {
    setDownloadFormat(format);
    try {
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brief: persisted.brief,
          goals,
          usage,
          gaps,
          opportunities,
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
      link.download = `${persisted.brief.accountName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloadFormat(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-3xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}
      <BriefView
        brief={persisted.brief as Brief}
        initialEditedBrief={persisted.editedBrief}
        goals={goals}
        usage={usage}
        gaps={gaps}
        opportunities={opportunities}
        sourceMap={persisted.sourceMap}
        accountId={accountId}
        accountVertical={accountVertical ?? undefined}
        usageTotals={usageTotals}
        stages={stages}
        onDownload={downloadArtifact}
        downloadFormat={downloadFormat}
        onSave={(editedBrief) => persistBrief(editedBrief, false)}
        onApprove={(editedBrief) => persistBrief(editedBrief, true)}
        saveState={saveState}
        approvedAt={approvedState}
        exportLocked={!approvedState}
        showIntegrations={false}
      />
    </div>
  );
}
