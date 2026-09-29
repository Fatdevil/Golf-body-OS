import { calculateGolfBodyScore } from "../../src/core/metrics/golf-body-score";
import { screeningToProfile } from "../../src/core/training/adapters/screening-to-profile";
import { buildDailyPlan } from "../../src/core/training/engine/plan-builder";
import { EXERCISE_LIBRARY } from "../../src/core/training/data/exercise-library";
import type { DailyState } from "../../src/core/training/types/daily-state";
import type { GolfContext } from "../../src/core/training/types/golf-context";
import type { TrainingHistory } from "../../src/core/training/types/training-history";
import { report } from "./fixtures";
const history: TrainingHistory = {
  userId: "test",
  completedPlans: [],
  currentStreak: 0,
  longestStreak: 0,
  totalPlansCompleted: 0,
  lastCompletedAt: null,
  averageCompletionRate: 0,
};
const state: DailyState = {
  bodyFeel: "NORMAL",
  painAreas: [],
  perceivedReadiness: 3,
  recordedAt: new Date("2026-09-29T10:00:00Z"),
};
function profile() {
  return screeningToProfile(calculateGolfBodyScore(report(), null), "test");
}
const cases = ([10, 20, 30] as const).flatMap((timeBudget) =>
  (["AUTO", "MOBILITY", "STRENGTH", "RECOVERY"] as const).map((focusMode) => ({
    timeBudget,
    focusMode,
  })),
);
test.each(cases)(
  "T01 score → profile → plan respects $timeBudget minutes / $focusMode",
  (context) => {
    const p = profile();
    const snapshot = JSON.stringify(p);
    const plan = buildDailyPlan(
      p,
      state,
      { ...context, golfToday: "NONE", golfTomorrow: "NONE" },
      EXERCISE_LIBRARY,
      history,
    );
    expect(plan.exercises.length).toBeGreaterThan(0);
    const seconds = plan.exercises.reduce(
      (sum, x) => sum + x.estimatedDurationSec,
      0,
    );
    expect(seconds).toBeLessThanOrEqual(context.timeBudget * 60);
    expect(
      plan.exercises.every(
        (x) =>
          Number.isFinite(x.estimatedDurationSec) && x.estimatedDurationSec > 0,
      ),
    ).toBe(true);
    expect(new Set(plan.exercises.map((x) => x.exercise.id)).size).toBe(
      plan.exercises.length,
    );
    expect(JSON.stringify(p)).toBe(snapshot);
  },
);
test("T02 unmeasured capacity and power do not become measured domains", () => {
  const p = profile();
  expect(p.capacity.status).toBe("NOT_TESTED");
  expect(p.power.status).toBe("NOT_TESTED");
});
test("T03 significant lower-back discomfort activates safety and excludes tagged exercises", () => {
  const plan = buildDailyPlan(
    profile(),
    {
      ...state,
      painAreas: [{ region: "LOWER_BACK", intensity: "SIGNIFICANT" }],
    },
    {
      timeBudget: 20,
      focusMode: "AUTO",
      golfToday: "NONE",
      golfTomorrow: "NONE",
    },
    EXERCISE_LIBRARY,
    history,
  );
  expect(plan.safetyModeActive).toBe(true);
  expect(plan.safetyAdjustments.length).toBeGreaterThan(0);
  for (const item of plan.exercises)
    expect(item.exercise.contraindicationTags).not.toContain("LOWER_BACK");
});
test("T04 unavailable exercise library gives an empty finite plan", () => {
  const plan = buildDailyPlan(
    profile(),
    state,
    {
      timeBudget: 10,
      focusMode: "AUTO",
      golfToday: "NONE",
      golfTomorrow: "NONE",
    },
    [],
    history,
  );
  expect(plan.exercises).toEqual([]);
  expect(plan.totalMinutes).toBe(0);
  expect(Object.values(plan.distribution).every(Number.isFinite)).toBe(true);
});
test("T05 exercise selection and dose are deterministic for unchanged inputs", () => {
  const p = profile();
  const context: GolfContext = {
    timeBudget: 20,
    focusMode: "AUTO",
    golfToday: "COMPETITION",
    golfTomorrow: "NONE",
  };
  expect(
    buildDailyPlan(p, state, context, EXERCISE_LIBRARY, history).exercises,
  ).toEqual(
    buildDailyPlan(p, state, context, EXERCISE_LIBRARY, history).exercises,
  );
});
