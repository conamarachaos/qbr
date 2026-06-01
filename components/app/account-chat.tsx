"use client";

import { useRef, useState } from "react";
import { Send, ShieldCheck, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Citation {
  sourceId: string;
  quote: string;
  grounded: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
}

interface SourceLabel {
  id: string;
  label: string;
  type: string;
}

let messageCounter = 0;
function nextId() {
  messageCounter += 1;
  return `local-${messageCounter}`;
}

export function AccountChat({
  accountId,
  initialMessages,
  sources,
}: {
  accountId: string;
  initialMessages: Message[];
  sources: SourceLabel[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [question, setQuestion] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sourceLabel = (id: string) => sources.find((source) => source.id === id);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isPending) {
      return;
    }

    setError(null);
    setIsPending(true);

    const history = messages.map((message) => ({ role: message.role, content: message.content }));
    const userMessage: Message = { id: nextId(), role: "user", content: trimmed, citations: [] };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      const response = await fetch(`/api/accounts/${accountId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to get an answer.");
      }

      const result = (await response.json()) as {
        answer: string;
        citations: Citation[];
      };

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: result.answer, citations: result.citations },
      ]);

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask about this account</CardTitle>
        <CardDescription>
          Answers come only from this account&apos;s saved sources and its latest QBR brief. Every
          claim is backed by a verbatim quote and verified against the cited source.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={scrollRef} className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              No questions yet. Try &ldquo;What are the customer&apos;s main goals?&rdquo; or
              &ldquo;Which gaps back the top upsell?&rdquo;
            </p>
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="space-y-2">
                  <div className="max-w-[90%] rounded-3xl bg-muted/60 px-4 py-3 text-sm leading-6 text-foreground/90">
                    {message.content}
                  </div>
                  {message.citations.length > 0 ? (
                    <div className="space-y-2 pl-1">
                      {message.citations.map((citation, index) => {
                        const source = sourceLabel(citation.sourceId);
                        return (
                          <div
                            key={`${message.id}-${index}`}
                            className="rounded-2xl border border-border/70 bg-card/60 p-3 text-xs"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{source?.label ?? citation.sourceId}</Badge>
                              {source ? <Badge variant="secondary">{source.type}</Badge> : null}
                              {citation.grounded ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <ShieldCheck className="h-3.5 w-3.5" /> verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-600">
                                  <ShieldAlert className="h-3.5 w-3.5" /> unverified quote
                                </span>
                              )}
                            </div>
                            <p className="italic text-foreground/75">&ldquo;{citation.quote}&rdquo;</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ),
            )
          )}
          {isPending ? (
            <div className="flex justify-start">
              <div
                className="flex items-center gap-1 rounded-3xl bg-muted/60 px-4 py-3"
                role="status"
                aria-label="Assistant is typing"
              >
                <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about this account…"
            rows={2}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit(event);
              }
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !question.trim()}>
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "Thinking…" : "Ask"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
