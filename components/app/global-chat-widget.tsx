"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, ShieldAlert, ShieldCheck, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  accountName?: string;
}

interface AccountOption {
  id: string;
  name: string;
}

let counter = 0;
function nextId() {
  counter += 1;
  return `g-${counter}`;
}

/** Extract an account id from a path like `/accounts/<id>` or `/accounts/<id>/qbr/...`. */
function accountIdFromPath(pathname: string | null): string {
  const match = pathname?.match(/^\/accounts\/([^/]+)/);
  return match ? match[1] : "";
}

export function GlobalChatWidget({ accounts }: { accounts: AccountOption[] }) {
  const pathname = usePathname();
  const pageAccountId = accountIdFromPath(pathname);

  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  // Whether the user has hand-picked an account; if not, we keep following the page.
  const [userPicked, setUserPicked] = useState(false);

  // Auto-select the account whose page we're on, until the user picks one manually.
  // Only honor ids that exist in the user's visible account list.
  useEffect(() => {
    if (userPicked) {
      return;
    }
    if (pageAccountId && accounts.some((account) => account.id === pageAccountId)) {
      setAccountId(pageAccountId);
    } else {
      setAccountId("");
    }
  }, [pageAccountId, accounts, userPicked]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isPending) {
      return;
    }

    setError(null);
    setIsPending(true);
    const history = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: trimmed, citations: [] }]);
    setQuestion("");
    scrollToBottom();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          accountId: accountId || undefined,
          history,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to get an answer.");
      }

      // The server couldn't tell which account this is about.
      if (payload.needsAccount) {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: payload.message, citations: [] },
        ]);
        scrollToBottom();
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: payload.answer,
          citations: payload.citations ?? [],
          accountName: payload.accountName,
        },
      ]);
      // Remember the resolved account so follow-ups stay on it (e.g. the user
      // named a different account in their question). Pin it against auto-follow.
      if (payload.accountId && payload.accountId !== accountId) {
        setUserPicked(true);
        setAccountId(payload.accountId);
      }
      scrollToBottom();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
        aria-label="Open account assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-[24rem] max-w-[calc(100vw-3rem)] flex-col rounded-3xl border border-border/70 bg-background shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="font-semibold">Account assistant</div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="border-b border-border/70 px-4 py-2">
        <select
          value={accountId}
          onChange={(event) => {
            setUserPicked(true);
            setAccountId(event.target.value);
          }}
          className="h-9 w-full rounded-full border border-input bg-background px-3 text-sm"
        >
          <option value="">Any account (name it in your question)</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
            Ask about any account — pick one above, or just name it: &ldquo;How is Meridian
            Furniture doing?&rdquo; Answers are grounded in that account&apos;s sources.
          </p>
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {message.content}
                </div>
              </div>
            ) : (
              <div key={message.id} className="space-y-2">
                {message.accountName ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {message.accountName}
                  </Badge>
                ) : null}
                <div className="max-w-[90%] rounded-2xl bg-muted/60 px-3 py-2 text-sm leading-6 text-foreground/90">
                  {message.content}
                </div>
                {message.citations.length > 0 ? (
                  <div className="space-y-1.5">
                    {message.citations.map((citation, index) => (
                      <div
                        key={`${message.id}-${index}`}
                        className="rounded-xl border border-border/70 bg-card/60 p-2 text-[11px]"
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          {citation.grounded ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <ShieldCheck className="h-3 w-3" /> verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <ShieldAlert className="h-3 w-3" /> unverified
                            </span>
                          )}
                        </div>
                        <p className="italic text-foreground/75">&ldquo;{citation.quote}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border/70 p-3">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about an account…"
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit(event);
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={isPending || !question.trim()}>
            <Send className="mr-2 h-4 w-4" />
            {isPending ? "Thinking…" : "Ask"}
          </Button>
        </div>
      </form>
    </div>
  );
}
