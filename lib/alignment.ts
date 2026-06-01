import { type GapStatus, type OppStage } from "@prisma/client";

// Goals/usage live only in the QbrRun JSON (no relational Goal table), while
// gaps and opportunities are DB rows the kanban boards mutate. This module is
// the pure join that powers the account page's Goals & usage alignment panel:
// per goal, the count of *open* gaps and opportunities currently tied to it.
//
// Kept separate from the page (a server component) so the rollup is unit
// testable without rendering.

// A gap is "open work" until it's been resolved or dropped.
const CLOSED_GAP_STATUSES = new Set<GapStatus>(["addressed", "dismissed"]);
// An opportunity is "open work" until it's been won or lost.
const CLOSED_OPP_STAGES = new Set<OppStage>(["won", "lost"]);

export type GoalRollupGap = { goalId: string | null; status: GapStatus };
export type GoalRollupOpp = { goalId: string | null; stage: OppStage };

export type GoalRollup = { gapCount: number; opportunityCount: number };

// Returns open gap/opportunity counts keyed by goalId. Rows with a null goalId
// (persisted before the column existed, or unlinkable) are skipped — they don't
// roll up to any goal. Closed gaps/opps don't count toward open work.
export function rollUpGoalWork(
  gaps: GoalRollupGap[],
  opportunities: GoalRollupOpp[],
): Map<string, GoalRollup> {
  const byGoal = new Map<string, GoalRollup>();

  const ensure = (goalId: string): GoalRollup => {
    let entry = byGoal.get(goalId);
    if (!entry) {
      entry = { gapCount: 0, opportunityCount: 0 };
      byGoal.set(goalId, entry);
    }
    return entry;
  };

  for (const gap of gaps) {
    if (!gap.goalId || CLOSED_GAP_STATUSES.has(gap.status)) continue;
    ensure(gap.goalId).gapCount += 1;
  }

  for (const opp of opportunities) {
    if (!opp.goalId || CLOSED_OPP_STAGES.has(opp.stage)) continue;
    ensure(opp.goalId).opportunityCount += 1;
  }

  return byGoal;
}
