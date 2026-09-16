/**
 * Time Packer — Fills available time with highest-priority exercises.
 *
 * PURE FUNCTION — no side effects, no API calls, no randomness.
 * Same input → same output. Always.
 *
 * Algorithm:
 * 1. Calculate target category distribution from focus mode
 * 2. Greedy fill: iterate matches by score, add if within budget and distribution
 * 3. Enforce constraints: min 2, max 8, at least 1 mobility
 * 4. Order: mobility → control → strength → recovery
 *
 * @module time-packer
 */

import type { FocusMode, GolfContext } from '../types/golf-context';
import type { ExerciseAssignment } from '../types/daily-plan';
import type { ExerciseCategory } from '../types/exercise';
import type { ExerciseMatch } from './exercise-matcher';

// ---------------------------------------------------------------------------
// Distribution targets
// ---------------------------------------------------------------------------

interface CategoryDistribution {
  MOBILITY: number;
  CONTROL: number;
  STRENGTH: number;
  RECOVERY: number;
  POWER: number;
}

const DISTRIBUTIONS: Record<FocusMode, CategoryDistribution> = {
  AUTO:     { MOBILITY: 0.50, CONTROL: 0.20, STRENGTH: 0.25, RECOVERY: 0.05, POWER: 0.00 },
  MOBILITY: { MOBILITY: 0.70, CONTROL: 0.15, STRENGTH: 0.10, RECOVERY: 0.05, POWER: 0.00 },
  STRENGTH: { MOBILITY: 0.25, CONTROL: 0.20, STRENGTH: 0.45, RECOVERY: 0.10, POWER: 0.00 },
  RECOVERY: { MOBILITY: 0.35, CONTROL: 0.15, STRENGTH: 0.00, RECOVERY: 0.50, POWER: 0.00 },
};

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

const MIN_EXERCISES = 2;
const MAX_EXERCISES = 8;

// Execution order for categories
const CATEGORY_ORDER: ExerciseCategory[] = ['MOBILITY', 'CONTROL', 'STRENGTH', 'POWER', 'RECOVERY'];

// ---------------------------------------------------------------------------
// Helper: estimate duration with adjusted dose
// ---------------------------------------------------------------------------

function estimateDuration(match: ExerciseMatch): number {
  const dose = match.adjustedDose;
  const baseDuration = match.exercise.estimatedDurationSec;

  // Rough estimation: scale based on dose changes vs default
  const defaultDose = match.exercise.defaultDose;
  const defaultSets = defaultDose.sets || 1;
  const actualSets = dose.sets || 1;

  const ratio = actualSets / defaultSets;
  return Math.round(baseDuration * ratio);
}

// ---------------------------------------------------------------------------
// Packing algorithm
// ---------------------------------------------------------------------------

/**
 * Fills available time with highest-priority exercises.
 *
 * PURE FUNCTION — same input → same output.
 */
export function packExercisesIntoTime(
  matches: ExerciseMatch[],
  timeBudgetMinutes: number,
  focusMode: FocusMode,
  context?: GolfContext,
): ExerciseAssignment[] {
  if (matches.length === 0) return [];

  const budgetSec = timeBudgetMinutes * 60;
  
  // Clone distribution to modify it if needed
  const targetDist = { ...DISTRIBUTIONS[focusMode] };
  
  // HARD CAP for strength/power if competition tomorrow
  if (context?.golfTomorrow === 'COMPETITION') {
    const strengthPowerCap = 0.10; // Max 10%
    if (targetDist.STRENGTH > strengthPowerCap) {
      const diff = targetDist.STRENGTH - strengthPowerCap;
      targetDist.STRENGTH = strengthPowerCap;
      targetDist.MOBILITY += diff; // Shift the rest to mobility
    }
  }

  // Track how much time is allocated per category
  const allocatedSec: Record<ExerciseCategory, number> = {
    MOBILITY: 0, CONTROL: 0, STRENGTH: 0, RECOVERY: 0, POWER: 0,
  };
  let totalAllocatedSec = 0;

  const selected: { match: ExerciseMatch; durationSec: number }[] = [];
  const usedIds = new Set<string>();

  // Pass 1: Greedy fill respecting distribution
  for (const match of matches) {
    if (selected.length >= MAX_EXERCISES) break;
    if (usedIds.has(match.exercise.id)) continue;

    const duration = estimateDuration(match);
    const category = match.exercise.category;

    // Would this exceed total budget?
    if (totalAllocatedSec + duration > budgetSec) continue;

    // Would this category exceed its target allocation?
    const targetSec = budgetSec * targetDist[category];
    if (allocatedSec[category] + duration > targetSec * 1.5) {
      // Allow 50% overshoot, but not more
      continue;
    }

    selected.push({ match, durationSec: duration });
    usedIds.add(match.exercise.id);
    allocatedSec[category] += duration;
    totalAllocatedSec += duration;
  }

  // Pass 2: If under minimum, add more exercises ignoring distribution
  if (selected.length < MIN_EXERCISES) {
    for (const match of matches) {
      if (selected.length >= MIN_EXERCISES) break;
      if (usedIds.has(match.exercise.id)) continue;

      const duration = estimateDuration(match);
      if (totalAllocatedSec + duration > budgetSec) continue;

      selected.push({ match, durationSec: duration });
      usedIds.add(match.exercise.id);
      totalAllocatedSec += duration;
    }
  }

  // Pass 3: Ensure at least 1 mobility exercise
  const hasMobility = selected.some(s => s.match.exercise.category === 'MOBILITY');
  if (!hasMobility) {
    const mobilityMatch = matches.find(
      m => m.exercise.category === 'MOBILITY' && !usedIds.has(m.exercise.id)
    );
    if (mobilityMatch) {
      const duration = estimateDuration(mobilityMatch);
      // Try to replace the lowest-scored non-mobility exercise
      if (selected.length >= MAX_EXERCISES || totalAllocatedSec + duration > budgetSec) {
        const lowestIdx = selected.reduce((minIdx, s, idx, arr) =>
          s.match.matchScore < arr[minIdx].match.matchScore ? idx : minIdx, 0
        );
        
        // Only replace if the new total time still fits within budget
        const newTotalSec = totalAllocatedSec - selected[lowestIdx].durationSec + duration;
        if (newTotalSec <= budgetSec) {
          totalAllocatedSec = newTotalSec;
          selected[lowestIdx] = { match: mobilityMatch, durationSec: duration };
        }
      } else {
        selected.push({ match: mobilityMatch, durationSec: duration });
        totalAllocatedSec += duration;
      }
    }
  }

  // Pass 4: If time remaining, try to fill with more exercises
  if (totalAllocatedSec < budgetSec * 0.7 && selected.length < MAX_EXERCISES) {
    for (const match of matches) {
      if (selected.length >= MAX_EXERCISES) break;
      if (usedIds.has(match.exercise.id)) continue;

      const duration = estimateDuration(match);
      if (totalAllocatedSec + duration > budgetSec) continue;

      selected.push({ match, durationSec: duration });
      usedIds.add(match.exercise.id);
      totalAllocatedSec += duration;
    }
  }

  // Sort by category execution order, then by match score within category
  selected.sort((a, b) => {
    const orderA = CATEGORY_ORDER.indexOf(a.match.exercise.category);
    const orderB = CATEGORY_ORDER.indexOf(b.match.exercise.category);
    if (orderA !== orderB) return orderA - orderB;
    return b.match.matchScore - a.match.matchScore;
  });

  // Build ExerciseAssignment[]
  return selected.map((s, idx) => ({
    exercise: s.match.exercise,
    dose: s.match.adjustedDose,
    order: idx + 1,
    rationale: {
      sv: s.match.matchReasons.join('. ') || 'Vald baserat på din profil',
      en: s.match.matchReasons.join('. ') || 'Selected based on your profile',
    },
    addressesFindings: s.match.exercise.targetFindings,
    estimatedDurationSec: s.durationSec,
  }));
}
