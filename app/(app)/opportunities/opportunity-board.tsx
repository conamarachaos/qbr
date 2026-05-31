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
import { type OppStage } from "@prisma/client";

import { moveOpportunityStageAction } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STAGES = ["identified", "qualified", "proposed", "won", "lost"] as const satisfies readonly OppStage[];

export type BoardOpportunity = {
  id: string;
  accountId: string;
  stage: OppStage;
  feature: string;
  title: string | null;
  pitch: string;
  expectedImpact: string | null;
  score: number | null;
  account: {
    id: string;
    name: string;
    tier: string;
  };
};

function opportunityHeading(opportunity: BoardOpportunity) {
  const title = opportunity.title?.trim();
  if (title) return title;
  // Fallback for opportunities created before titles existed: first sentence of the pitch.
  const firstSentence = opportunity.pitch.split(/(?<=[.!?])\s/)[0] ?? opportunity.pitch;
  return firstSentence.length > 80 ? `${firstSentence.slice(0, 77)}…` : firstSentence;
}

// Won is good (green), lost is bad (red), the rest are in-progress (neutral).
const STAGE_VARIANT: Record<OppStage, "success" | "destructive" | "secondary"> = {
  identified: "secondary",
  qualified: "secondary",
  proposed: "secondary",
  won: "success",
  lost: "destructive",
};

function OpportunityCard({
  opportunity,
  overlay = false,
  onOpenDetails,
}: {
  opportunity: BoardOpportunity;
  overlay?: boolean;
  onOpenDetails?: (opportunity: BoardOpportunity) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: opportunity.id,
    data: { accountId: opportunity.accountId },
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
        <div className="font-medium leading-snug">{opportunityHeading(opportunity)}</div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{opportunity.pitch}</p>
        <div className="mt-1 text-xs text-muted-foreground">{opportunity.account.name}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{opportunity.feature}</Badge>
        <Badge variant="secondary">{opportunity.account.tier.replace("_", " ")}</Badge>
      </div>
      {!overlay && onOpenDetails ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Stop pointer events from reaching the drag listeners so a click opens
          // details instead of starting a drag.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpenDetails(opportunity)}
          className="h-7 px-2 text-xs"
        >
          View details
        </Button>
      ) : null}
    </div>
  );
}

function OpportunityDetailsDialog({
  opportunity,
  onClose,
}: {
  opportunity: BoardOpportunity | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(opportunity)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        {opportunity ? (
          <>
            <DialogHeader>
              <DialogTitle>{opportunityHeading(opportunity)}</DialogTitle>
              <DialogDescription>
                {opportunity.account.name} · {opportunity.feature}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pitch
                </div>
                <p className="mt-1 whitespace-pre-wrap">{opportunity.pitch}</p>
              </div>
              {opportunity.expectedImpact ? (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Expected impact
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{opportunity.expectedImpact}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={STAGE_VARIANT[opportunity.stage]} className="capitalize">
                  {opportunity.stage}
                </Badge>
                <Badge variant="outline">{opportunity.account.tier.replace("_", " ")}</Badge>
                {typeof opportunity.score === "number" ? (
                  <Badge variant="outline">score {opportunity.score.toFixed(2)}</Badge>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StageColumn({
  stage,
  opportunities,
  onOpenDetails,
}: {
  stage: OppStage;
  opportunities: BoardOpportunity[];
  onOpenDetails: (opportunity: BoardOpportunity) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <Card
      ref={setNodeRef}
      className={`flex h-full flex-col ${isOver ? "ring-2 ring-primary/50" : ""}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg capitalize">
          {stage}
          <Badge variant="secondary">{opportunities.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-24 flex-1 space-y-3">
        {opportunities.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            No opportunities here.
          </div>
        ) : (
          opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              onOpenDetails={onOpenDetails}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function OpportunityBoard({
  opportunities,
  showAccountFilter = true,
}: {
  opportunities: BoardOpportunity[];
  // Hide the per-account dropdown when the board is already scoped to a single
  // account (e.g. the account detail page). Search stays available.
  showAccountFilter?: boolean;
}) {
  const [items, setItems] = useState(opportunities);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState<string>("all");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const accounts = useMemo(() => {
    const map = new Map<string, string>();
    for (const opp of items) map.set(opp.account.id, opp.account.name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((opp) => {
      if (accountId !== "all" && opp.account.id !== accountId) return false;
      if (!query) return true;
      return (
        opp.pitch.toLowerCase().includes(query) ||
        opp.feature.toLowerCase().includes(query) ||
        opp.account.name.toLowerCase().includes(query)
      );
    });
  }, [items, search, accountId]);

  const activeOpportunity = activeId ? items.find((opp) => opp.id === activeId) ?? null : null;
  const detailsOpportunity = detailsId ? items.find((opp) => opp.id === detailsId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const opportunityId = String(active.id);
    const nextStage = over.id as OppStage;
    const moved = items.find((opp) => opp.id === opportunityId);
    if (!moved || moved.stage === nextStage) return;

    const previous = items;
    // Optimistic update
    setItems((current) =>
      current.map((opp) => (opp.id === opportunityId ? { ...opp, stage: nextStage } : opp)),
    );

    startTransition(async () => {
      try {
        await moveOpportunityStageAction({
          accountId: moved.accountId,
          opportunityId,
          stage: nextStage,
        });
      } catch {
        // Roll back on failure
        setItems(previous);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by pitch, feature, or account…"
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
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid gap-4 xl:grid-cols-5">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              opportunities={filtered.filter((opp) => opp.stage === stage)}
              onOpenDetails={(opportunity) => setDetailsId(opportunity.id)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeOpportunity ? (
            <OpportunityCard opportunity={activeOpportunity} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <OpportunityDetailsDialog
        opportunity={detailsOpportunity}
        onClose={() => setDetailsId(null)}
      />
    </div>
  );
}
