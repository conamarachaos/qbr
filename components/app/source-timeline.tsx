"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Mail,
  Phone,
  Send,
  Sparkles,
  Table2,
  WandSparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TimelineSourceSummary {
  tldr: string;
  keyPoints: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
}

export interface TimelineSource {
  id: string;
  label: string;
  type: string;
  content: string;
  createdAt: string; // ISO
  summary?: TimelineSourceSummary | null;
}

const TYPE_META: Record<string, { label: string; icon: typeof Phone }> = {
  call: { label: "Call transcript", icon: Phone },
  email: { label: "Email thread", icon: Mail },
  usage: { label: "Usage data", icon: Table2 },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Sparkles };
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso));
}

// Usage CSV/JSON is noisy; show a friendlier one-liner instead of raw dump.
function previewText(source: TimelineSource) {
  if (source.type === "usage") {
    return "Structured usage metrics — reviews, AI products, calls, messaging, integrations.";
  }
  return source.content.replace(/\s+/g, " ").trim().slice(0, 180);
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const SENTIMENT_DISPLAY: Record<
  TimelineSourceSummary["sentiment"],
  {
    label: string;
    icon: string;
    variant: "success" | "secondary" | "warning" | "destructive";
  }
> = {
  positive: { label: "Positive", icon: "🙂", variant: "success" },
  neutral: { label: "Neutral", icon: "😐", variant: "secondary" },
  mixed: { label: "Mixed", icon: "🤔", variant: "warning" },
  negative: { label: "Negative", icon: "🙁", variant: "destructive" },
};

function ArtifactCard({
  accountId,
  source,
}: {
  // When undefined, the source is shown read-only (no account-scoped APIs to
  // summarize or ask AI against — e.g. the standalone workbench).
  accountId?: string;
  source: TimelineSource;
}) {
  const aiEnabled = Boolean(accountId);
  const meta = typeMeta(source.type);
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI summary — seeded from the persisted summary (if any), so it shows on load.
  const [summary, setSummary] = useState<TimelineSourceSummary | null>(source.summary ?? null);
  const [open, setOpenSummary] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Fetch (or force-refresh) the summary from the server.
  async function fetchSummary(force: boolean) {
    if (summarizing) return;
    setSummaryError(null);
    setSummarizing(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/sources/${source.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        setSummaryError("Couldn't summarize this source. Try again.");
        return;
      }
      const data = (await res.json()) as { summary?: TimelineSourceSummary };
      if (data.summary) {
        setSummary(data.summary);
        setOpenSummary(true);
      }
    } catch {
      setSummaryError("Network error. Try again.");
    } finally {
      setSummarizing(false);
    }
  }

  function onSummarizeClick() {
    // If we already have a summary, just toggle its visibility; otherwise fetch.
    if (summary) {
      setOpenSummary((v) => !v);
    } else {
      void fetchSummary(false);
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setError(null);
    setPending(true);

    // Scope the question to this artifact so retrieval surfaces it.
    const scoped = `Regarding the source "${source.label}" (${meta.label}): ${trimmed}`;
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((cur) => [...cur, { role: "user", content: trimmed }]);
    setQuestion("");

    try {
      const res = await fetch(`/api/accounts/${accountId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: scoped, history }),
      });
      if (!res.ok) {
        setError("Couldn't get an answer. Try again.");
        return;
      }
      const data = (await res.json()) as { answer?: string };
      setTurns((cur) => [...cur, { role: "assistant", content: data.answer ?? "No answer." }]);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card/60 p-4 transition hover:border-primary/30">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{source.label}</span>
            <Badge variant="outline">{meta.label}</Badge>
            <span className="text-xs text-muted-foreground">{formatDate(source.createdAt)}</span>
          </div>
          {!expanded ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{previewText(source)}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {expanded ? "Less" : "More"}
          </Button>
          {/* Summarize fetches via the account API; with no account we can still
              toggle a persisted summary, but can't fetch a new one. */}
          {aiEnabled || summary ? (
            <Button
              variant={open ? "secondary" : "outline"}
              size="sm"
              onClick={onSummarizeClick}
              disabled={summarizing || (!aiEnabled && !summary)}
            >
              {summarizing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="h-4 w-4" />
              )}
              {summary ? "Summary" : "Summarize"}
            </Button>
          ) : null}
          {aiEnabled ? (
            <Button
              variant={asking ? "secondary" : "outline"}
              size="sm"
              onClick={() => setAsking((v) => !v)}
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </Button>
          ) : null}
        </div>
      </div>

      {summaryError ? (
        <p className="mt-2 text-xs text-destructive">{summaryError}</p>
      ) : null}

      {open && summary ? (
        <div className="mt-3 space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <Badge className="gap-1">
              <WandSparkles className="h-3 w-3" />
              AI summary
            </Badge>
            <Badge
              variant={SENTIMENT_DISPLAY[summary.sentiment].variant}
              className="gap-1"
              title={`Customer sentiment in this source: ${SENTIMENT_DISPLAY[summary.sentiment].label.toLowerCase()}`}
            >
              <span aria-hidden>{SENTIMENT_DISPLAY[summary.sentiment].icon}</span>
              {SENTIMENT_DISPLAY[summary.sentiment].label} sentiment
            </Badge>
            {aiEnabled ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => fetchSummary(true)}
                disabled={summarizing}
              >
                {summarizing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                Regenerate
              </Button>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-foreground/90">{summary.tldr}</p>
          <ul className="space-y-1 text-sm text-foreground/80">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl bg-muted/40 p-3">
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">{source.content}</p>
        </div>
      ) : null}

      {asking ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          {turns.length > 0 ? (
            <div className="space-y-2">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={`text-sm leading-6 ${
                    turn.role === "user" ? "font-medium text-foreground" : "text-foreground/85"
                  }`}
                >
                  <span className="mr-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {turn.role === "user" ? "You" : "AI"}
                  </span>
                  {turn.content}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ask anything about this {meta.label.toLowerCase()} — answers cite this account&apos;s
              sources.
            </p>
          )}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <form onSubmit={ask} className="flex items-center gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`e.g. What did they ask for in this ${meta.label.toLowerCase()}?`}
              disabled={pending}
            />
            <Button type="submit" size="sm" disabled={pending || !question.trim()}>
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function SourceTimeline({
  accountId,
  sources,
}: {
  // Optional: when omitted, sources render read-only (no summarize / ask-AI).
  accountId?: string;
  sources: TimelineSource[];
}) {
  if (sources.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
        No sources yet. Upload transcripts, emails, or usage to build this account&apos;s timeline.
      </div>
    );
  }

  // Chronological flow; grouping headers appear when the type changes so calls,
  // emails, and usage read as a sequence over time.
  const ordered = [...sources].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="relative space-y-4 pl-6">
      {/* The connecting spine of the flow. */}
      <span className="absolute bottom-2 left-[11px] top-2 w-px bg-border" aria-hidden />
      {ordered.map((source) => {
        const Icon = typeMeta(source.type).icon;
        return (
          <div key={source.id} className="relative">
            {/* Node on the spine */}
            <span className="absolute -left-6 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-primary">
              <Icon className="h-3 w-3" />
            </span>
            <ArtifactCard accountId={accountId} source={source} />
          </div>
        );
      })}
    </div>
  );
}
