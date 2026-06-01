"use client";

import { useState, useTransition } from "react";
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
import { type ActionStatus } from "@prisma/client";

import {
  addActionItemAction,
  moveActionItemStatusAction,
  removeActionItemAction,
} from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES = ["open", "in_progress", "done"] as const satisfies readonly ActionStatus[];

const STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_VARIANT: Record<ActionStatus, "secondary" | "warning" | "success"> = {
  open: "secondary",
  in_progress: "warning",
  done: "success",
};

export type BoardActionItem = {
  id: string;
  accountId: string;
  title: string;
  status: ActionStatus;
  ownerId: string | null;
  // ISO string — serializable across the server/client boundary.
  dueDate: string | null;
};

function formatDue(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  return `Due ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date)}`;
}

function ActionItemCard({
  item,
  overlay = false,
  onDelete,
  deleting = false,
}: {
  item: BoardActionItem;
  overlay?: boolean;
  onDelete?: (item: BoardActionItem) => void;
  deleting?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { accountId: item.accountId },
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          className={`font-medium leading-snug ${
            item.status === "done" ? "text-muted-foreground line-through" : ""
          }`}
        >
          {item.title}
        </div>
        <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {formatDue(item.dueDate)} · owner {item.ownerId || "unassigned"}
      </div>
      {!overlay && onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Stop pointer events from reaching the drag listeners so a click
          // deletes instead of starting a drag.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onDelete(item)}
          disabled={deleting}
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
        >
          Delete
        </Button>
      ) : null}
    </div>
  );
}

function StatusColumn({
  status,
  items,
  onDelete,
  deletingId,
}: {
  status: ActionStatus;
  items: BoardActionItem[];
  onDelete: (item: BoardActionItem) => void;
  deletingId: string | null;
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
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-24 flex-1 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            Nothing here.
          </div>
        ) : (
          items.map((item) => (
            <ActionItemCard
              key={item.id}
              item={item}
              onDelete={onDelete}
              deleting={deletingId === item.id}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AddActionItemDialog({
  open,
  onOpenChange,
  onCreate,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: { title: string; dueDate: string | null }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  function reset() {
    setTitle("");
    setDueDate("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), dueDate: dueDate || null });
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add action item</DialogTitle>
            <DialogDescription>
              Track a next step on the mutual action plan for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="action-item-title">Title</Label>
              <Input
                id="action-item-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Schedule product adoption workshop"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-item-due">Due date</Label>
              <Input
                id="action-item-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Saving…" : "Save action item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ActionItemBoard({
  accountId,
  qbrRunId,
  actionItems,
}: {
  accountId: string;
  qbrRunId?: string;
  actionItems: BoardActionItem[];
}) {
  const [items, setItems] = useState(actionItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingCreate, startCreate] = useTransition();
  const [, startMove] = useTransition();
  const [, startDelete] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeItem = activeId ? items.find((item) => item.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const actionItemId = String(active.id);
    const nextStatus = over.id as ActionStatus;
    const moved = items.find((item) => item.id === actionItemId);
    if (!moved || moved.status === nextStatus) return;

    const previous = items;
    // Optimistic update
    setItems((current) =>
      current.map((item) =>
        item.id === actionItemId ? { ...item, status: nextStatus } : item,
      ),
    );

    startMove(async () => {
      try {
        await moveActionItemStatusAction({ accountId, actionItemId, status: nextStatus });
      } catch {
        setItems(previous);
      }
    });
  }

  function handleDelete(item: BoardActionItem) {
    const previous = items;
    setDeletingId(item.id);
    setItems((current) => current.filter((entry) => entry.id !== item.id));

    startDelete(async () => {
      try {
        await removeActionItemAction({ accountId, actionItemId: item.id });
      } catch {
        setItems(previous);
      } finally {
        setDeletingId(null);
      }
    });
  }

  function handleCreate(input: { title: string; dueDate: string | null }) {
    startCreate(async () => {
      try {
        const created = await addActionItemAction({
          accountId,
          qbrRunId,
          title: input.title,
          dueDate: input.dueDate,
        });
        setItems((current) => [
          {
            id: created.id,
            accountId: created.accountId,
            title: created.title,
            status: created.status,
            ownerId: created.ownerId,
            dueDate: created.dueDate,
          },
          ...current,
        ]);
        setDialogOpen(false);
      } catch {
        // Leave the dialog open so the user can retry.
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Drag a card between columns to update its status.
        </p>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          Add action item
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {STATUSES.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              items={items.filter((item) => item.status === status)}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? <ActionItemCard item={activeItem} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <AddActionItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
        pending={pendingCreate}
      />
    </div>
  );
}
