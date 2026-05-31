"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SourceIngestForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [type, setType] = useState<"call" | "email" | "usage">("call");
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setContent(text);
    if (!label) {
      setLabel(file.name);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload = {
      type,
      label: label.trim() || `${type} source`,
      content: content.trim(),
    };

    if (!payload.content) {
      setMessage("Add pasted text or upload a file before saving.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/accounts/${accountId}/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(data?.message ?? "Failed to save source.");
        return;
      }

      setContent("");
      setLabel("");
      setMessage("Source saved.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border/70 bg-background/80 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="source-type">Source type</Label>
          <select
            id="source-type"
            value={type}
            onChange={(event) => setType(event.target.value as "call" | "email" | "usage")}
            className="flex h-10 w-full rounded-full border border-input bg-background px-4 text-sm"
          >
            <option value="call">Call transcript</option>
            <option value="email">Email thread</option>
            <option value="usage">Usage snapshot</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-label">Label</Label>
          <Input
            id="source-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Q2 account review transcript"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-file">Upload file</Label>
        <div className="flex items-center gap-3">
          <Input id="source-file" type="file" accept=".txt,.json,.csv,.eml,.vtt" onChange={handleFileChange} />
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-content">Paste content</Label>
        <Textarea
          id="source-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-[220px]"
          placeholder="Paste transcript, email thread, or usage JSON/CSV here."
        />
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save source"}
      </Button>
    </form>
  );
}
