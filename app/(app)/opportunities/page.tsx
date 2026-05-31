import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { listWorkspaceOpportunities } from "@/lib/repo/accounts";

import { OpportunityBoard, type BoardOpportunity } from "./opportunity-board";

export default async function OpportunitiesPage() {
  const user = await requireCurrentUser();
  const opportunities = await listWorkspaceOpportunities({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  });

  const boardOpportunities: BoardOpportunity[] = opportunities.map((opportunity) => ({
    id: opportunity.id,
    accountId: opportunity.accountId,
    stage: opportunity.stage,
    feature: opportunity.feature,
    title: opportunity.title,
    pitch: opportunity.pitch,
    expectedImpact: opportunity.expectedImpact,
    score: opportunity.score,
    account: {
      id: opportunity.account.id,
      name: opportunity.account.name,
      tier: opportunity.account.tier,
    },
  }));

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-3xl">Opportunities</CardTitle>
        </CardHeader>
      </Card>

      <OpportunityBoard opportunities={boardOpportunities} />
    </div>
  );
}
