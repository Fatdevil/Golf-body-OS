/**
 * Smoke test — verifies the training engine pipeline compiles and runs.
 *
 * Run: npx ts-node --esm src/core/training/__tests__/smoke-test.ts
 * (or just verify it compiles)
 */

import type { BodyProfile } from '../types/body-profile';
import type { DailyState } from '../types/daily-state';
import type { GolfContext } from '../types/golf-context';
import type { TrainingHistory } from '../types/training-history';
import { buildDailyPlan } from '../engine/plan-builder';
import { EXERCISE_LIBRARY, LIBRARY_VERSION } from '../data/exercise-library';

// ─── Mock data ────────────────────────────────────────────────────────────

const mockProfile: BodyProfile = {
  id: 'profile-1',
  userId: 'user-1',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
  mobility: {
    domain: 'MOBILITY',
    areas: [
      {
        areaId: 'hip-rotation-limited',
        label: { sv: 'Höftrotation', en: 'Hip Rotation' },
        score: 12,
        maxScore: 25,
        quality: 'FAIR',
        rawMeasurements: { leftDeg: 32, rightDeg: 40 },
        compensations: ['asymmetry'],
        lastTestedAt: new Date('2025-01-15'),
      },
      {
        areaId: 'thoracic-rotation-limited',
        label: { sv: 'Bröstryggsrotation', en: 'Thoracic Rotation' },
        score: 8,
        maxScore: 25,
        quality: 'POOR',
        rawMeasurements: { leftDeg: 28, rightDeg: 32 },
        compensations: [],
        lastTestedAt: new Date('2025-01-15'),
      },
    ],
    compositeScore: 40,
    confidence: 'HIGH',
    lastTestedAt: new Date('2025-01-15'),
    source: 'SCREENING',
  },
  motorControl: {
    domain: 'MOTOR_CONTROL',
    areas: [
      {
        areaId: 'trunk-control-poor',
        label: { sv: 'Bålkontroll', en: 'Trunk Control' },
        score: 15,
        maxScore: 25,
        quality: 'FAIR',
        rawMeasurements: {},
        compensations: [],
        lastTestedAt: new Date('2025-01-15'),
      },
    ],
    compositeScore: 60,
    confidence: 'MODERATE',
    lastTestedAt: new Date('2025-01-15'),
    source: 'SCREENING',
  },
  loadTolerance: {
    domain: 'LOAD_TOLERANCE',
    areas: [
      {
        areaId: 'glute-activation-poor',
        label: { sv: 'Sätesaktivering', en: 'Glute Activation' },
        score: 10,
        maxScore: 25,
        quality: 'FAIR',
        rawMeasurements: {},
        compensations: [],
        lastTestedAt: new Date('2025-01-15'),
      },
    ],
    compositeScore: 40,
    confidence: 'MODERATE',
    lastTestedAt: new Date('2025-01-15'),
    source: 'SCREENING',
  },
  golfBodyScore: 47,
  golfBodyTier: 'MODERATE',
  primaryBottlenecks: [
    {
      id: 'thoracic-rotation-limited',
      domain: 'MOBILITY',
      areaId: 'thoracic-rotation-limited',
      type: 'LIMITATION',
      severity: 'MODERATE',
      label: { sv: 'Begränsad bröstryggsrotation', en: 'Limited thoracic rotation' },
      description: { sv: 'Rotationsomfånget i bröstryggen är under optimal nivå', en: 'Thoracic rotation range is below optimal level' },
      compatibleExerciseTags: ['thoracic-rotation-limited'],
      confidence: 'HIGH',
    },
  ],
  keyStrengths: [],
};

const mockState: DailyState = {
  bodyFeel: 'STIFF',
  painAreas: [],
  perceivedReadiness: 3,
  recordedAt: new Date(),
};

const mockContext: GolfContext = {
  golfToday: 'NONE',
  golfTomorrow: 'EIGHTEEN_HOLES',
  timeBudget: 20,
  focusMode: 'AUTO',
};

const emptyHistory: TrainingHistory = {
  userId: 'user-1',
  completedPlans: [],
  currentStreak: 0,
  longestStreak: 0,
  totalPlansCompleted: 0,
  lastCompletedAt: null,
  averageCompletionRate: 0,
};

// ─── Run ──────────────────────────────────────────────────────────────────

console.log(`\n🏌️ Golf Body OS — Training Engine Smoke Test`);
console.log(`   Library v${LIBRARY_VERSION}: ${EXERCISE_LIBRARY.length} exercises\n`);

const plan = buildDailyPlan(mockProfile, mockState, mockContext, EXERCISE_LIBRARY, emptyHistory);

console.log(`📋 Plan ID: ${plan.id}`);
console.log(`⏱️  Total: ${plan.totalMinutes} min`);
console.log(`🎯 Focus: ${plan.focusSummary.sv}`);
console.log(`📊 Distribution: Mobility ${plan.distribution.mobilityPercent}% | Control ${plan.distribution.controlPercent}% | Strength ${plan.distribution.strengthPercent}% | Recovery ${plan.distribution.recoveryPercent}%`);
console.log(`🛡️  Safety mode: ${plan.safetyModeActive ? 'ACTIVE' : 'OFF'}`);
console.log(`\n💬 Rationale: ${plan.rationale.sv}\n`);

console.log(`📦 Exercises (${plan.exercises.length}):`);
for (const ex of plan.exercises) {
  const dose = ex.dose;
  const doseStr = dose.reps
    ? `${dose.sets}×${dose.reps} reps`
    : `${dose.sets}×${dose.holdSeconds}s hold`;
  console.log(`  ${ex.order}. [${ex.exercise.category}] ${ex.exercise.name.sv} — ${doseStr} (~${Math.round(ex.estimatedDurationSec / 60)} min)`);
}

console.log(`\n✅ Smoke test passed — engine pipeline works end-to-end\n`);
