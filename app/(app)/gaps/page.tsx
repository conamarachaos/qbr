import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { listWorkspaceGaps } from "@/lib/repo/accounts";

import { GapBoard, type BoardGap } from "./gap-board";

export default async function GapsPage() {
  const user = await requireCurrentUser();
  const gaps = await listWorkspaceGaps({
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  });

  const boardGaps: BoardGap[] = gaps.map((gap) => ({
    id: gap.id,
    accountId: gap.accountId,
    status: gap.status,
    feature: gap.feature,
    reason: gap.reason,
    severity: gap.severity,
    account: {
      id: gap.account.id,
      name: gap.account.name,
      tier: gap.account.tier,
    },
  }));

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-display text-3xl">Gaps</CardTitle>
        </CardHeader>
      </Card>

      <GapBoard gaps={boardGaps} />
    </div>
  );
}
