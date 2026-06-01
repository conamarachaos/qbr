"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { type GapStatus } from "@prisma/client";

import { moveGapStatusAction } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["open", "in_progress", "addressed", "dismissed"] as const satisfies readonly GapStatus[];

const STATUS_LABEL: Record<GapStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  addressed: "Addressed",
  dismissed: "Dismissed",
};

// Severity 1-5 → a quick visual cue. Higher = more urgent.
function severityVariant(severity: number): "destructive" | "warning" | "secondary" {
  if (severity >= 4) return "destructive";
  if (severity >= 3) return "warning";
  return "secondary";
}

export type BoardGap = {
  id: string;
  accountId: string;
  status: GapStatus;
  feature: string;
  reason: string;
  severity: number;
  account: {
    id: string;
    name: string;
    tier: string;
  };
};

function GapCard({ gap, overlay = false }: { gap: BoardGap; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: gap.id,
    data: { accountId: gap.accountId },
    disabled: overlay,
  });

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      style={{ touchAction: "none" }}
      className={`cursor-grab touch-none select-none space-y-3 rounded-3xl border border-border/70 bg-background p-4 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      } ${overlay ? "shadow-lg" : ""}`}
    >
      <div>
        <div className="font-medium leading-snug">{gap.feature}</div>
        <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{gap.reason}</p>
        <div className="mt-1 text-xs text-muted-foreground">{gap.account.name}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant={severityVariant(gap.severity)}>severity {gap.severity}</Badge>
        <Badge variant="secondary">{gap.account.tier.replace("_", " ")}</Badge>
      </div>
    </div>
  );
}

function StatusColumn({
  status,
  gaps,
}: {
  status: GapStatus;
  gaps: BoardGap[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <Card
      ref={setNodeRef}
      className={`flex h-full flex-col ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          {STATUS_LABEL[status]}
          <Badge variant="secondary">{gaps.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-24 flex-1 space-y-3">
        {gaps.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            No gaps here.
          </div>
        ) : (
          gaps.map((gap) => <GapCard key={gap.id} gap={gap} />)
        )}
      </CardContent>
    </Card>
  );
}

export function GapBoard({
  gaps,
  showAccountFilter = true,
}: {
  gaps: BoardGap[];
  // Hide the per-account dropdown when the board is already scoped to a single
  // account (e.g. the account detail page). Search stays available.
  showAccountFilter?: boolean;
}) {
  const [items, setItems] = useState(gaps);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState<string>("all");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const gap of items) map.set(gap.account.id, gap.account.name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((gap) => {
      if (accountId !== "all" && gap.account.id !== accountId) return false;
      if (!query) return true;
      return (
        gap.reason.toLowerCase().includes(query) ||
        gap.feature.toLowerCase().includes(query) ||
        gap.account.name.toLowerCase().includes(query)
      );
    });
  }, [items, search, accountId]);

  const activeGap = activeId ? items.find((gap) => gap.id === activeId) ?? null : null;

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const gapId = String(active.id);
    const nextStatus = over.id as GapStatus;
    const moved = items.find((gap) => gap.id === gapId);
    if (!moved || moved.status === nextStatus) return;

    const previous = items;
    setItems((current) =>
      current.map((gap) => (gap.id === gapId ? { ...gap, status: nextStatus } : gap)),
    );

    startTransition(async () => {
      try {
        await moveGapStatusAction({
          accountId: moved.accountId,
          gapId,
          status: nextStatus,
        });
      } catch {
        setItems(previous);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by reason, feature, or account…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-sm"
        />
        {showAccountFilter ? (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {(search || accountId !== "all") && (
          <span className="text-sm text-muted-foreground">{filtered.length} matching</span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid gap-4 xl:grid-cols-4">
          {STATUSES.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              gaps={filtered.filter((gap) => gap.status === status)}
            />
          ))}
        </div>
        <DragOverlay>{activeGap ? <GapCard gap={activeGap} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
