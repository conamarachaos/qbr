import Link from "next/link";

import { GlobalChatWidget } from "@/components/app/global-chat-widget";
import { SignOutButton } from "@/components/app/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { listPortfolioAccounts } from "@/lib/repo/accounts";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  const accounts = await listPortfolioAccounts({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  });

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto grid min-h-screen w-full gap-6 px-4 py-6 md:grid-cols-[320px_1fr] md:px-8 2xl:px-12">
        <aside className="flex h-full flex-col gap-6 rounded-[28px] border border-border/70 bg-background p-5 shadow-sm">
          <div className="space-y-2">
            <Badge className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
              QBR Agent
            </Badge>
            <div>
              <h1 className="font-display text-2xl font-semibold">Customer workspace</h1>
              <p className="text-sm text-muted-foreground">
                Portfolio, sources, QBRs, and expansion actions in one tenant-scoped shell.
              </p>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/portfolio">Portfolio</Link>
            </Button>
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/opportunities">Opportunities</Link>
            </Button>
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/gaps">Gaps</Link>
            </Button>
            <Button asChild variant="ghost" className="justify-start">
              <Link href="/workbench">Workbench</Link>
            </Button>
          </nav>

          <div className="mt-auto rounded-3xl border border-border/70 bg-muted/40 p-4">
            <div className="text-sm font-semibold">{user.name || user.email}</div>
            <div className="mt-1 text-xs text-muted-foreground">{user.email}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{user.role.replace("_", " ")}</Badge>
              <Badge variant="secondary">{user.workspaceId}</Badge>
            </div>
          </div>

          <SignOutButton />
        </aside>

        <div className="min-w-0">{children}</div>
      </div>

      <GlobalChatWidget
        accounts={accounts.map((account) => ({ id: account.id, name: account.name }))}
      />
    </div>
  );
}
