/**
 * screening-to-profile.test.ts
 * Untested screening pillars must not become measured limitations in the
 * profile (and therefore must not drive the training plan).
 */

import { calculateGolfBodyScore } from '../../../src/core/metrics/golf-body-score';
import { screeningToProfile } from '../../../src/core/training/adapters/screening-to-profile';
import { buildDailyPlan } from '../../../src/core/training/engine/plan-builder';
import { EXERCISE_LIBRARY } from '../../../src/core/training/data/exercise-library';

const hingeReport = (hinge: number, knee: number): any => ({
  measurement: {
    metrics: [
      { id: 'HIP_HINGE_ANGLE_2D', value: hinge },
      { id: 'KNEE_ANGLE_AT_ENDPOINT', value: knee },
    ],
    compensations: [],
  },
});

const state: any = { bodyFeel: 'NORMAL', painAreas: [], perceivedReadiness: 3, recordedAt: new Date() };
const context: any = { golfToday: 'NONE', golfTomorrow: 'NONE', timeBudget: 20, focusMode: 'AUTO' };
const history: any = { completedPlans: [] };

describe('screeningToProfile with untested pillars', () => {
  test('hinge-only screening creates no thoracic/pelvic areas, findings or priorities', () => {
    const profile = screeningToProfile(calculateGolfBodyScore(hingeReport(88, 158), null));

    const areaIds = [...profile.mobility.areas, ...profile.motorControl.areas].map((a) => a.areaId);
    expect(areaIds.some((id) => /thoracic|pelvic/.test(id))).toBe(false);
    expect(profile.primaryBottlenecks.map((f) => f.id).some((id) => /thoracic|pelvic/.test(id))).toBe(false);

    const plan = buildDailyPlan(profile, state, context, EXERCISE_LIBRARY, history);
    const reasons = plan.exercises.map((e) => e.rationale.en).join(' ');
    expect(reasons).not.toMatch(/thoracic-rotation-limited|pelvic-stability-poor|pelvic-over-rotation/);
  });

  test('nothing tested → mobility is NOT_TESTED and there are no findings', () => {
    const profile = screeningToProfile(calculateGolfBodyScore(null, null));
    expect(profile.mobility.status).toBe('NOT_TESTED');
    expect(profile.mobility.areas).toEqual([]);
    expect(profile.motorControl.status).toBe('NOT_TESTED');
    expect(profile.primaryBottlenecks).toEqual([]);
  });

  test('legacy scores without the measured flag are still treated as measured', () => {
    const score = calculateGolfBodyScore(hingeReport(120, 158), null);
    delete (score.hipHinge as any).measured;
    const profile = screeningToProfile(score);
    expect(profile.mobility.areas.some((a) => a.areaId === 'hip-hinge-limited')).toBe(true);
  });
});
