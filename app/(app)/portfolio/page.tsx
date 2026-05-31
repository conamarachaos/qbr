import Link from "next/link";
import { type Tier } from "@prisma/client";
import { Plus } from "lucide-react";

import { createAccountAction } from "@/app/(app)/actions";
import { UploadModal } from "@/components/app/upload-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireCurrentUser } from "@/lib/auth/session";
import { listPortfolioAccounts } from "@/lib/repo/accounts";

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value) : "Not set";
}

function healthVariant(category?: string | null) {
  if (category === "healthy") {
    return "default" as const;
  }
  if (category === "at_risk") {
    return "secondary" as const;
  }
  return "destructive" as const;
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentUser();
  const params = (await searchParams) ?? {};
  const tier = (Array.isArray(params.tier) ? params.tier[0] : params.tier) as Tier | "all" | undefined;
  const sort = (Array.isArray(params.sort) ? params.sort[0] : params.sort) as
    | "renewal-asc"
    | "renewal-desc"
    | undefined;

  const sessionContext = {
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  };

  const accounts = await listPortfolioAccounts(sessionContext, {
    tier: tier ?? "all",
    sort: sort ?? "renewal-asc",
  });

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between md:space-y-0">
          <div>
            <CardTitle className="font-display text-3xl">Portfolio</CardTitle>
            <CardDescription>
              {user.role === "am"
                ? "Accounts assigned to you."
                : "Workspace-scoped customer accounts across the portfolio."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UploadModal />
            {(["all", "strategic", "growth", "at_risk"] as const).map((value) => (
              <Button
                key={value}
                asChild
                variant={tier === value || (!tier && value === "all") ? "default" : "outline"}
                size="sm"
              >
                <Link href={`/portfolio?tier=${value}&sort=${sort ?? "renewal-asc"}`}>{value.replace("_", " ")}</Link>
              </Button>
            ))}
            <Button asChild variant="outline" size="sm">
              <Link href={`/portfolio?tier=${tier ?? "all"}&sort=${sort === "renewal-desc" ? "renewal-asc" : "renewal-desc"}`}>
                Sort {sort === "renewal-desc" ? "earliest renewal" : "latest renewal"}
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Customer accounts</CardTitle>
            <CardDescription>
              Renewal timing, latest health signal, and most recent QBR status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
                No accounts match the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="px-2 py-3">Account</th>
                      <th className="px-2 py-3">Tier</th>
                      <th className="px-2 py-3">ARR</th>
                      <th className="px-2 py-3">Renewal</th>
                      <th className="px-2 py-3">Health</th>
                      <th className="px-2 py-3">Last QBR</th>
                      <th className="px-2 py-3">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="border-b border-border/50 last:border-b-0">
                        <td className="px-2 py-4">
                          <Link href={`/accounts/${account.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                            {account.name}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {account.vertical || "Unclassified vertical"}
                          </div>
                        </td>
                        <td className="px-2 py-4">
                          <Badge variant="outline">{account.tier.replace("_", " ")}</Badge>
                        </td>
                        <td className="px-2 py-4">
                          {typeof account.arr === "number" ? `$${account.arr.toLocaleString()}` : "n/a"}
                        </td>
                        <td className="px-2 py-4">{formatDate(account.renewalDate)}</td>
                        <td className="px-2 py-4">
                          <Badge variant={healthVariant(account.latestHealth?.category)}>
                            {account.latestHealth?.overall ?? "n/a"}
                          </Badge>
                        </td>
                        <td className="px-2 py-4">
                          {account.latestQbr ? formatDate(account.latestQbr.createdAt) : "Not run"}
                        </td>
                        <td className="px-2 py-4">
                          {account.qbrDue ? (
                            <Badge variant="destructive">QBR due</Badge>
                          ) : (
                            <Badge variant="secondary">On track</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="new-account" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>New account</CardTitle>
            <CardDescription>
              Manually create an ad-hoc customer record and assign yourself as primary owner.
              For real source files, use Upload above instead — the agent routes each file to
              the right account (creating it if new) and attaches it. Tier and renewal date
              here are optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAccountAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vertical">Vertical</Label>
                <Input id="vertical" name="vertical" placeholder="Home Services" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tier">Tier</Label>
                  <select
                    id="tier"
                    name="tier"
                    defaultValue="growth"
                    className="flex h-10 w-full rounded-full border border-input bg-background px-4 text-sm"
                  >
                    <option value="strategic">strategic</option>
                    <option value="growth">growth</option>
                    <option value="at_risk">at_risk</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arr">ARR</Label>
                  <Input id="arr" name="arr" type="number" min="0" placeholder="90000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="renewalDate">Renewal date</Label>
                <Input id="renewalDate" name="renewalDate" type="date" />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
