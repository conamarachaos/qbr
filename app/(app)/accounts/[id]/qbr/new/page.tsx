import Link from "next/link";
import { notFound } from "next/navigation";

import { RunWizard } from "@/components/app/run-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { getAccountDetail } from "@/lib/repo/accounts";

export default async function NewQbrRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const account = await getAccountDetail(
    {
      userId: user.id,
      workspaceId: user.workspaceId,
      role: user.role,
    },
    id,
  );

  if (!account) {
    notFound();
  }

  const calls = account.sources.filter((source) => source.type === "call").length;
  const emails = account.sources.filter((source) => source.type === "email").length;

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between md:space-y-0">
          <div>
            <CardTitle className="font-display text-3xl">Generate QBR — {account.name}</CardTitle>
            <CardDescription>
              Run the five-stage agent: Goal Extraction → Usage Analysis → Gap Detection →
              Opportunity Mapping → Narrative. The run, brief, and seeded opportunities are saved on
              completion.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/accounts/${account.id}`}>Back to account</Link>
          </Button>
        </CardHeader>
      </Card>

      <RunWizard
        accountId={account.id}
        inputs={{ calls, emails, usage: account.usageSnapshots.length }}
      />
    </div>
  );
}
