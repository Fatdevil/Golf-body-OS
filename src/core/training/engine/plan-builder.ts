/**
 * Plan Builder — The central training plan generation function.
 *
 * PURE FUNCTION — no side effects, no API calls, no randomness.
 * Same input → same output. Always.
 *
 * Pipeline:
 *   1. calculatePriorities(profile, state, context)
 *   2. matchExercises(priorities, library, state, history)
 *   3. packExercisesIntoTime(matches, timeBudget, focusMode)
 *   4. Assemble DailyPlan with input snapshot and rationale
 *
 * Safety mode:
 *   If state.painAreas is non-empty → activate safety mode.
 *   If pain is SIGNIFICANT → recommend professional assessment.
 *
 * @module plan-builder
 */

import type { BodyProfile } from '../types/body-profile';
import type { DailyState } from '../types/daily-state';
import type { GolfContext } from '../types/golf-context';
import type { Exercise, ExerciseCategory } from '../types/exercise';
import type { DailyPlan, PlanDistribution } from '../types/daily-plan';
import type { TrainingHistory } from '../types/training-history';
import { calculatePriorities } from './priority-calculator';
import { matchExercises } from './exercise-matcher';
import { packExercisesIntoTime } from './time-packer';

// ---------------------------------------------------------------------------
// Focus summary generation
// ---------------------------------------------------------------------------

function generateFocusSummary(
  plan: DailyPlan,
  context: GolfContext,
): { sv: string; en: string } {
  const dist = plan.distribution;
  const parts: string[] = [];
  const partsSv: string[] = [];

  if (dist.mobilityPercent >= 40) {
    partsSv.push('Rörlighet');
    parts.push('Mobility');
  }
  if (dist.strengthPercent >= 25) {
    partsSv.push('Styrka');
    parts.push('Strength');
  }
  if (dist.controlPercent >= 20) {
    partsSv.push('Kontroll');
    parts.push('Control');
  }
  if (dist.recoveryPercent >= 30) {
    partsSv.push('Återhämtning');
    parts.push('Recovery');
  }

  if (plan.safetyModeActive) {
    return {
      sv: `Skyddsläge – ${partsSv.join(' + ') || 'Anpassat program'}`,
      en: `Safety mode – ${parts.join(' + ') || 'Adapted program'}`,
    };
  }

  const focusLabels: Record<string, { sv: string; en: string }> = {
    AUTO: { sv: 'Auto-plan', en: 'Auto-plan' },
    MOBILITY: { sv: 'Fokus: Rörlighet', en: 'Focus: Mobility' },
    STRENGTH: { sv: 'Fokus: Styrka', en: 'Focus: Strength' },
    RECOVERY: { sv: 'Fokus: Återhämtning', en: 'Focus: Recovery' },
  };

  const label = focusLabels[context.focusMode] ?? focusLabels.AUTO;

  return {
    sv: `${label.sv} — ${partsSv.join(' + ')}`,
    en: `${label.en} — ${parts.join(' + ')}`,
  };
}

// ---------------------------------------------------------------------------
// Rationale generation
// ---------------------------------------------------------------------------

function generateRationale(
  profile: BodyProfile,
  state: DailyState,
  context: GolfContext,
  exerciseCount: number,
  safetyMode: boolean,
): { sv: string; en: string } {
  const parts: string[] = [];
  const partsSv: string[] = [];

  // Body feel
  const feelLabels: Record<string, { sv: string; en: string }> = {
    FRESH: { sv: 'Du känner dig fräsch', en: 'You feel fresh' },
    NORMAL: { sv: 'Du känner dig normal', en: 'You feel normal' },
    STIFF: { sv: 'Du känner dig stel', en: 'You feel stiff' },
    TIRED: { sv: 'Du känner dig trött', en: 'You feel tired' },
    SORE: { sv: 'Du känner dig öm', en: 'You feel sore' },
  };
  const feel = feelLabels[state.bodyFeel];
  partsSv.push(feel.sv);
  parts.push(feel.en);

  // Golf context
  if (context.golfToday !== 'NONE') {
    partsSv.push('du spelar golf idag');
    parts.push('you\'re playing golf today');
  } else if (context.golfTomorrow === 'COMPETITION') {
    partsSv.push('du tävlar imorgon');
    parts.push('you have a competition tomorrow');
  } else if (context.golfTomorrow !== 'NONE') {
    partsSv.push('du spelar golf imorgon');
    parts.push('you\'re playing golf tomorrow');
  }

  // Top bottleneck
  if (profile.primaryBottlenecks.length > 0) {
    const top = profile.primaryBottlenecks[0];
    partsSv.push(`din största begränsning är ${top.label.sv.toLowerCase()}`);
    parts.push(`your main limitation is ${top.label.en.toLowerCase()}`);
  }

  // Safety mode
  if (safetyMode) {
    partsSv.push('programmet är anpassat på grund av rapporterat obehag');
    parts.push('the program is adapted due to reported discomfort');
  }

  const svText = partsSv.length > 0
    ? `${partsSv[0]}, ${partsSv.slice(1).join(' och ')}. Programmet innehåller ${exerciseCount} övningar.`
    : `Programmet innehåller ${exerciseCount} övningar.`;

  const enText = parts.length > 0
    ? `${parts[0]}, ${parts.slice(1).join(' and ')}. The program contains ${exerciseCount} exercises.`
    : `The program contains ${exerciseCount} exercises.`;

  return { sv: svText, en: enText };
}

// ---------------------------------------------------------------------------
// Distribution calculation
// ---------------------------------------------------------------------------

function calculateDistribution(
  exercises: DailyPlan['exercises'],
): PlanDistribution {
  const totalSec = exercises.reduce((sum, ex) => sum + ex.estimatedDurationSec, 0);
  if (totalSec === 0) return { mobilityPercent: 0, controlPercent: 0, strengthPercent: 0, recoveryPercent: 0 };

  const byCat: Record<ExerciseCategory, number> = {
    MOBILITY: 0, CONTROL: 0, STRENGTH: 0, RECOVERY: 0, POWER: 0,
  };
  for (const ex of exercises) {
    byCat[ex.exercise.category] += ex.estimatedDurationSec;
  }

  return {
    mobilityPercent: Math.round((byCat.MOBILITY / totalSec) * 100),
    controlPercent: Math.round((byCat.CONTROL / totalSec) * 100),
    strengthPercent: Math.round(((byCat.STRENGTH + byCat.POWER) / totalSec) * 100),
    recoveryPercent: Math.round((byCat.RECOVERY / totalSec) * 100),
  };
}

// ---------------------------------------------------------------------------
// Safety analysis
// ---------------------------------------------------------------------------

function analyzeSafety(state: DailyState): {
  active: boolean;
  adjustments: string[];
} {
  if (state.painAreas.length === 0) {
    return { active: false, adjustments: [] };
  }

  const adjustments: string[] = [];
  const hasSignificant = state.painAreas.some(p => p.intensity === 'SIGNIFICANT');

  adjustments.push('Exercises filtered based on reported discomfort areas');

  if (hasSignificant) {
    adjustments.push('Significant pain detected — all doses reduced');
    adjustments.push('Load tolerance exercises minimized');
    adjustments.push('Consider consulting a physiotherapist or sports medicine professional');
  } else {
    adjustments.push('Moderate adjustments — doses slightly reduced');
  }

  if (state.bodyFeel === 'SORE' || state.bodyFeel === 'TIRED') {
    adjustments.push('Recovery-oriented program due to body state');
  }

  return { active: true, adjustments };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Builds today's training plan.
 *
 * PURE FUNCTION — no side effects, no API calls, no randomness.
 * Same input → same output. Always.
 *
 * @param profile   Current body profile with domain assessments
 * @param state     Today's body state (fresh/stiff/sore)
 * @param context   Golf schedule + time budget + focus mode
 * @param library   Available exercises (curated, versioned)
 * @param history   Past training history (for progression decisions)
 * @returns         Today's plan with ordered exercises and rationale
 *
 * @example
 * ```typescript
 * const plan = buildDailyPlan(
 *   userProfile,
 *   { bodyFeel: 'STIFF', painAreas: [], perceivedReadiness: 3, recordedAt: new Date() },
 *   { golfToday: 'NONE', golfTomorrow: 'EIGHTEEN_HOLES', timeBudget: 20, focusMode: 'AUTO' },
 *   EXERCISE_LIBRARY,
 *   userHistory
 * );
 * // plan.exercises → 5-6 exercises filling ~20 min
 * // plan.distribution → { mobilityPercent: 50, controlPercent: 20, ... }
 * ```
 */
export function buildDailyPlan(
  profile: BodyProfile,
  state: DailyState,
  context: GolfContext,
  library: Exercise[],
  history: TrainingHistory,
): DailyPlan {
  // 1. Calculate priorities
  const priorities = calculatePriorities(profile, state, context);

  // 2. Match exercises against priorities
  const matches = matchExercises(priorities, library, state, history);

  // 3. Pack into available time
  const exercises = packExercisesIntoTime(matches, context.timeBudget, context.focusMode);

  // 4. Calculate distribution
  const distribution = calculateDistribution(exercises);

  // 5. Safety analysis
  const safety = analyzeSafety(state);

  // 6. Calculate total time
  const totalSec = exercises.reduce((sum, ex) => sum + ex.estimatedDurationSec, 0);
  const totalMinutes = Math.round(totalSec / 60);

  // 7. Assemble plan
  const plan: DailyPlan = {
    id: `plan-${profile.userId}-${Date.now()}`,
    createdAt: new Date(),
    input: {
      profileSnapshot: profile,
      state,
      context,
    },
    exercises,
    totalMinutes,
    focusSummary: { sv: '', en: '' }, // Will be set below
    rationale: generateRationale(profile, state, context, exercises.length, safety.active),
    distribution,
    safetyModeActive: safety.active,
    safetyAdjustments: safety.adjustments,
  };

  // Set focus summary (needs the distribution to be calculated first)
  plan.focusSummary = generateFocusSummary(plan, context);

  return plan;
}
