import { describe, expect, it } from "vitest";

import { rollUpGoalWork, type GoalRollupGap, type GoalRollupOpp } from "@/lib/alignment";

describe("rollUpGoalWork", () => {
  it("counts open gaps and opportunities per goal", () => {
    const gaps: GoalRollupGap[] = [
      { goalId: "goal-001", status: "open" },
      { goalId: "goal-001", status: "in_progress" },
      { goalId: "goal-002", status: "open" },
    ];
    const opps: GoalRollupOpp[] = [
      { goalId: "goal-001", stage: "identified" },
      { goalId: "goal-002", stage: "qualified" },
      { goalId: "goal-002", stage: "proposed" },
    ];

    const result = rollUpGoalWork(gaps, opps);

    expect(result.get("goal-001")).toEqual({ gapCount: 2, opportunityCount: 1 });
    expect(result.get("goal-002")).toEqual({ gapCount: 1, opportunityCount: 2 });
  });

  it("excludes closed gaps (addressed/dismissed) and closed opps (won/lost)", () => {
    const gaps: GoalRollupGap[] = [
      { goalId: "goal-001", status: "open" },
      { goalId: "goal-001", status: "addressed" },
      { goalId: "goal-001", status: "dismissed" },
    ];
    const opps: GoalRollupOpp[] = [
      { goalId: "goal-001", stage: "proposed" },
      { goalId: "goal-001", stage: "won" },
      { goalId: "goal-001", stage: "lost" },
    ];

    const result = rollUpGoalWork(gaps, opps);

    // Only the one open gap and the one in-flight opp survive.
    expect(result.get("goal-001")).toEqual({ gapCount: 1, opportunityCount: 1 });
  });

  it("skips rows with a null goalId (pre-migration / unlinkable)", () => {
    const gaps: GoalRollupGap[] = [
      { goalId: null, status: "open" },
      { goalId: "goal-003", status: "open" },
    ];
    const opps: GoalRollupOpp[] = [{ goalId: null, stage: "identified" }];

    const result = rollUpGoalWork(gaps, opps);

    expect(result.has("goal-003")).toBe(true);
    expect(result.get("goal-003")).toEqual({ gapCount: 1, opportunityCount: 0 });
    // Null-goal rows never create an entry.
    expect(result.size).toBe(1);
  });

  it("returns an empty map when there is no open work", () => {
    const result = rollUpGoalWork(
      [{ goalId: "goal-001", status: "dismissed" }],
      [{ goalId: "goal-001", stage: "lost" }],
    );
    expect(result.size).toBe(0);
  });
});
