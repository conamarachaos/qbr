"use client";

import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";

import { deleteAccountAction, updateAccountAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const tiers = ["strategic", "growth", "at_risk"] as const;
const lifecycles = ["onboarding", "active", "renewal", "churned"] as const;

const selectClass =
  "flex h-10 w-full rounded-full border border-input bg-background px-4 text-sm";

function toDateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function AccountSettings({
  account,
}: {
  account: {
    id: string;
    name: string;
    vertical: string | null;
    tier: string;
    arr: number | null;
    renewalDate: Date | null;
    lifecycle: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit account
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/15">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Edit account</CardTitle>
          <CardDescription>
            Update account details or remove this customer from the workspace.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setOpen(false);
            setConfirmingDelete(false);
          }}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={updateAccountAction} className="space-y-4">
          <input type="hidden" name="accountId" value={account.id} />
          <div className="space-y-2">
            <Label htmlFor="edit-name">Account name</Label>
            <Input id="edit-name" name="name" defaultValue={account.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-vertical">Vertical</Label>
            <Input
              id="edit-vertical"
              name="vertical"
              defaultValue={account.vertical ?? ""}
              placeholder="Home Services"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-tier">Tier</Label>
              <select
                id="edit-tier"
                name="tier"
                defaultValue={account.tier}
                className={selectClass}
              >
                {tiers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lifecycle">Lifecycle</Label>
              <select
                id="edit-lifecycle"
                name="lifecycle"
                defaultValue={account.lifecycle}
                className={selectClass}
              >
                {lifecycles.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-arr">ARR</Label>
              <Input
                id="edit-arr"
                name="arr"
                type="number"
                min="0"
                defaultValue={account.arr ?? ""}
                placeholder="90000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-renewalDate">Renewal date</Label>
              <Input
                id="edit-renewalDate"
                name="renewalDate"
                type="date"
                defaultValue={toDateInputValue(account.renewalDate)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>

        <div className="border-t border-border/60 pt-4">
          {confirmingDelete ? (
            <form action={deleteAccountAction} className="space-y-3">
              <input type="hidden" name="accountId" value={account.id} />
              <p className="text-sm text-muted-foreground">
                Delete <span className="font-medium text-foreground">{account.name}</span> and
                all of its sources, health history, QBR runs, and opportunities? This cannot be
                undone.
              </p>
              <div className="flex gap-3">
                <Button type="submit" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  Confirm delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
