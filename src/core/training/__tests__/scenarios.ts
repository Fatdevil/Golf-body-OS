/**
 * Engine Scenario Tests — verifies training engine against 5 realistic scenarios.
 *
 * Each scenario validates:
 * - Correct number of exercises
 * - Appropriate category distribution
 * - Safety mode activation when expected
 * - Exercises fit within time budget
 *
 * Run: npx ts-node src/core/training/__tests__/scenarios.ts
 */

import type { BodyProfile, AreaScore, DomainAssessment } from '../types/body-profile';
import type { DailyState } from '../types/daily-state';
import type { GolfContext } from '../types/golf-context';
import type { TrainingHistory } from '../types/training-history';
import type { DailyPlan } from '../types/daily-plan';
import { buildDailyPlan } from '../engine/plan-builder';
import { EXERCISE_LIBRARY } from '../data/exercise-library';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const EMPTY_HISTORY: TrainingHistory = {
  userId: 'test-user',
  completedPlans: [],
  currentStreak: 0,
  longestStreak: 0,
  totalPlansCompleted: 0,
  lastCompletedAt: null,
  averageCompletionRate: 0,
};

function makeArea(id: string, score: number, max: number, label: string, compensations: string[] = []): AreaScore {
  return {
    areaId: id,
    label: { sv: label, en: label },
    score,
    maxScore: max,
    quality: score / max >= 0.85 ? 'EXCELLENT' : score / max >= 0.65 ? 'GOOD' : score / max >= 0.40 ? 'FAIR' : 'POOR',
    rawMeasurements: {},
    compensations,
    lastTestedAt: new Date(),
  };
}

function makeDomain(domain: 'MOBILITY' | 'MOTOR_CONTROL' | 'LOAD_TOLERANCE', areas: AreaScore[]): DomainAssessment {
  const total = areas.reduce((s, a) => s + a.score, 0);
  const max = areas.reduce((s, a) => s + a.maxScore, 0);
  return {
    domain,
    areas,
    compositeScore: max > 0 ? Math.round((total / max) * 100) : 50,
    confidence: 'HIGH',
    lastTestedAt: new Date(),
    source: 'SCREENING',
  };
}

function makeProfile(overrides?: Partial<BodyProfile>): BodyProfile {
  return {
    id: 'test-profile',
    userId: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    mobility: makeDomain('MOBILITY', [
      makeArea('hip-hinge-limited', 12, 25, 'Hip Hinge'),
      makeArea('thoracic-rotation-limited', 10, 25, 'Thoracic Rotation'),
      makeArea('hip-rotation-limited', 14, 25, 'Hip Rotation', ['asymmetry']),
    ]),
    motorControl: makeDomain('MOTOR_CONTROL', [
      makeArea('trunk-control-poor', 15, 25, 'Trunk Control'),
    ]),
    loadTolerance: makeDomain('LOAD_TOLERANCE', [
      makeArea('glute-activation-poor', 12, 25, 'Glute Activation'),
    ]),
    golfBodyScore: 47,
    golfBodyTier: 'MODERATE',
    primaryBottlenecks: [{
      id: 'thoracic-rotation-limited',
      domain: 'MOBILITY',
      areaId: 'thoracic-rotation-limited',
      type: 'LIMITATION',
      severity: 'MODERATE',
      label: { sv: 'Begränsad thoracic rotation', en: 'Limited thoracic rotation' },
      description: { sv: 'Under optimal nivå', en: 'Below optimal level' },
      compatibleExerciseTags: ['thoracic-rotation-limited'],
      confidence: 'HIGH',
    }],
    keyStrengths: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function describePlan(plan: DailyPlan) {
  console.log(`     📋 ${plan.exercises.length} exercises, ${plan.totalMinutes} min`);
  console.log(`     📊 Mob ${plan.distribution.mobilityPercent}% | Ctl ${plan.distribution.controlPercent}% | Str ${plan.distribution.strengthPercent}% | Rec ${plan.distribution.recoveryPercent}%`);
  console.log(`     🛡️  Safety: ${plan.safetyModeActive ? 'ON' : 'OFF'}`);
  for (const ex of plan.exercises) {
    console.log(`     ${ex.order}. [${ex.exercise.category}] ${ex.exercise.name.en}`);
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

console.log('\n🏌️ Golf Body OS — Engine Scenario Tests\n');

// ── Scenario 1: STIFF + no golf + 20 min + AUTO ──
console.log('── Scenario 1: Stiff, no golf, 20 min AUTO ──');
{
  const state: DailyState = { bodyFeel: 'STIFF', painAreas: [], perceivedReadiness: 3, recordedAt: new Date() };
  const context: GolfContext = { golfToday: 'NONE', golfTomorrow: 'NONE', timeBudget: 20, focusMode: 'AUTO' };
  const plan = buildDailyPlan(makeProfile(), state, context, EXERCISE_LIBRARY, EMPTY_HISTORY);
  describePlan(plan);

  assert(plan.exercises.length >= 2, `Has at least 2 exercises (got ${plan.exercises.length})`);
  assert(plan.exercises.length <= 8, `Has at most 8 exercises (got ${plan.exercises.length})`);
  assert(plan.totalMinutes <= 22, `Fits within ~20 min budget (got ${plan.totalMinutes})`);
  assert(plan.distribution.mobilityPercent >= 30, `Mobility-heavy when STIFF (got ${plan.distribution.mobilityPercent}%)`);
  assert(!plan.safetyModeActive, 'Safety mode OFF (no pain)');
  assert(plan.exercises.some(e => e.exercise.category === 'MOBILITY'), 'Has at least 1 mobility exercise');
}

// ── Scenario 2: FRESH + competition tomorrow + 10 min ──
console.log('\n── Scenario 2: Fresh, competition tomorrow, 10 min ──');
{
  const state: DailyState = { bodyFeel: 'FRESH', painAreas: [], perceivedReadiness: 5, recordedAt: new Date() };
  const context: GolfContext = { golfToday: 'NONE', golfTomorrow: 'COMPETITION', timeBudget: 10, focusMode: 'AUTO' };
  const plan = buildDailyPlan(makeProfile(), state, context, EXERCISE_LIBRARY, EMPTY_HISTORY);
  describePlan(plan);

  assert(plan.exercises.length >= 2, `Has at least 2 exercises (got ${plan.exercises.length})`);
  assert(plan.totalMinutes <= 12, `Fits within ~10 min budget (got ${plan.totalMinutes})`);
  assert(plan.distribution.strengthPercent < 30, `Low strength before competition (got ${plan.distribution.strengthPercent}%)`);
  assert(!plan.safetyModeActive, 'Safety mode OFF');
}

// ── Scenario 3: SORE + lower back pain + 20 min ──
console.log('\n── Scenario 3: Sore, lower back pain, 20 min ──');
{
  const state: DailyState = {
    bodyFeel: 'SORE',
    painAreas: [{ region: 'LOWER_BACK', intensity: 'MODERATE' }],
    perceivedReadiness: 1,
    recordedAt: new Date(),
  };
  const context: GolfContext = { golfToday: 'NONE', golfTomorrow: 'NONE', timeBudget: 20, focusMode: 'AUTO' };
  const plan = buildDailyPlan(makeProfile(), state, context, EXERCISE_LIBRARY, EMPTY_HISTORY);
  describePlan(plan);

  assert(plan.safetyModeActive, 'Safety mode ON (pain reported)');
  assert(plan.safetyAdjustments.length > 0, 'Has safety adjustments');
  // Lower back pain → hip hinge exercises should be filtered
  const hasHingeExercise = plan.exercises.some(e =>
    e.exercise.contraindicationTags.includes('LOWER_BACK')
  );
  assert(!hasHingeExercise, 'No lower-back contraindicated exercises in plan');
}

// ── Scenario 4: FRESH + no golf + 30 min + STRENGTH focus ──
console.log('\n── Scenario 4: Fresh, no golf, 30 min, STRENGTH focus ──');
{
  const state: DailyState = { bodyFeel: 'FRESH', painAreas: [], perceivedReadiness: 5, recordedAt: new Date() };
  const context: GolfContext = { golfToday: 'NONE', golfTomorrow: 'NONE', timeBudget: 30, focusMode: 'STRENGTH' };
  const plan = buildDailyPlan(makeProfile(), state, context, EXERCISE_LIBRARY, EMPTY_HISTORY);
  describePlan(plan);

  assert(plan.exercises.length >= 3, `More exercises with 30 min (got ${plan.exercises.length})`);
  assert(plan.totalMinutes <= 32, `Fits within ~30 min budget (got ${plan.totalMinutes})`);
  assert(plan.exercises.some(e => e.exercise.category === 'MOBILITY'), 'Still has at least 1 mobility exercise');
  assert(!plan.safetyModeActive, 'Safety mode OFF');
}

// ── Scenario 5: TIRED + 18 holes today + 10 min ──
console.log('\n── Scenario 5: Tired, 18 holes today, 10 min ──');
{
  const state: DailyState = { bodyFeel: 'TIRED', painAreas: [], perceivedReadiness: 2, recordedAt: new Date() };
  const context: GolfContext = { golfToday: 'EIGHTEEN_HOLES', golfTomorrow: 'NONE', timeBudget: 10, focusMode: 'AUTO' };
  const plan = buildDailyPlan(makeProfile(), state, context, EXERCISE_LIBRARY, EMPTY_HISTORY);
  describePlan(plan);

  assert(plan.exercises.length >= 2, `Has at least 2 exercises (got ${plan.exercises.length})`);
  assert(plan.totalMinutes <= 12, `Fits within ~10 min budget (got ${plan.totalMinutes})`);
  assert(plan.distribution.mobilityPercent >= 30, `Mobility-focused before golf (got ${plan.distribution.mobilityPercent}%)`);
  assert(!plan.safetyModeActive, 'Safety mode OFF');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${passed + failed} assertions: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) {
  console.log('⚠️  Some assertions failed — review the engine logic.');
  process.exitCode = 1;
} else {
  console.log('✅ All scenarios passed — engine behaves as expected.\n');
}
