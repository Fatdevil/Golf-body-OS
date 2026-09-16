/**
 * Exercise Matcher — Matches exercises from library against priorities.
 *
 * PURE FUNCTION — no side effects, no API calls, no randomness.
 * Same input → same output. Always.
 *
 * Algorithm:
 * 1. Filter out contraindicated exercises (pain areas)
 * 2. Score each exercise by overlap with priority areas
 * 3. Check history for progression/regression signals
 * 4. Adjust dose based on state
 * 5. Sort by matchScore descending
 *
 * @module exercise-matcher
 */

import type { Exercise, ExerciseDose } from '../types/exercise';
import type { DailyState, PainRegion } from '../types/daily-state';
import type { TrainingHistory } from '../types/training-history';
import type { TrainingPriority } from './priority-calculator';

// ---------------------------------------------------------------------------
// Exercise Match
// ---------------------------------------------------------------------------

/** A matched exercise with its score and adjusted dose */
export interface ExerciseMatch {
  /** The matched exercise */
  exercise: Exercise;
  /** How well this exercise matches the priorities (0.0 - 1.0) */
  matchScore: number;
  /** Why this exercise was matched */
  matchReasons: string[];
  /** Dose adjusted for user's level and state */
  adjustedDose: ExerciseDose;
}

// ---------------------------------------------------------------------------
// Pain → contraindication mapping
// ---------------------------------------------------------------------------

/**
 * Maps PainRegion to the contraindication tag format used in exercises.
 * E.g. 'LOWER_BACK' pain → exercises tagged with 'LOWER_BACK' are filtered.
 */
function getContraindicatedTags(state: DailyState): Set<string> {
  const tags = new Set<string>();
  for (const pain of state.painAreas) {
    tags.add(pain.region);
    // Significant pain: also block adjacent regions
    if (pain.intensity === 'SIGNIFICANT') {
      const adjacent = getAdjacentRegions(pain.region);
      for (const adj of adjacent) {
        tags.add(adj);
      }
    }
  }
  return tags;
}

function getAdjacentRegions(region: PainRegion): PainRegion[] {
  const map: Record<PainRegion, PainRegion[]> = {
    LOWER_BACK: ['HIP_LEFT', 'HIP_RIGHT'],
    UPPER_BACK: ['SHOULDER_LEFT', 'SHOULDER_RIGHT', 'NECK'],
    NECK: ['UPPER_BACK', 'SHOULDER_LEFT', 'SHOULDER_RIGHT'],
    SHOULDER_LEFT: ['UPPER_BACK', 'NECK'],
    SHOULDER_RIGHT: ['UPPER_BACK', 'NECK'],
    HIP_LEFT: ['LOWER_BACK', 'KNEE_LEFT'],
    HIP_RIGHT: ['LOWER_BACK', 'KNEE_RIGHT'],
    KNEE_LEFT: ['HIP_LEFT', 'ANKLE_LEFT'],
    KNEE_RIGHT: ['HIP_RIGHT', 'ANKLE_RIGHT'],
    ANKLE_LEFT: ['KNEE_LEFT'],
    ANKLE_RIGHT: ['KNEE_RIGHT'],
    OTHER: [],
  };
  return map[region] ?? [];
}

// ---------------------------------------------------------------------------
// Match scoring
// ---------------------------------------------------------------------------

/**
 * Score how well an exercise matches the current priorities.
 * Returns 0-1 with reasons.
 */
function scoreExercise(
  exercise: Exercise,
  priorities: TrainingPriority[],
): { score: number; reasons: string[] } {
  let totalScore = 0;
  const reasons: string[] = [];

  // 1. Finding compatibility — most important signal
  for (const priority of priorities) {
    if (exercise.compatibleFindings.includes(priority.areaId) ||
        exercise.targetFindings.includes(priority.areaId)) {
      totalScore += priority.priority * 0.5;
      reasons.push(`Addresses ${priority.areaId} (priority ${priority.priority})`);
    }
  }

  // 2. Category alignment with top domain
  const topDomain = priorities[0]?.domain;
  if (topDomain) {
    const categoryMap: Record<string, string> = {
      'MOBILITY': 'MOBILITY',
      'MOTOR_CONTROL': 'CONTROL',
      'LOAD_TOLERANCE': 'STRENGTH',
    };
    if (exercise.category === categoryMap[topDomain]) {
      totalScore += 0.15;
      reasons.push(`Category aligns with top priority domain`);
    }
  }

  // 3. Difficulty preference — favor beginner/intermediate for wider applicability
  if (exercise.difficulty === 'BEGINNER') {
    totalScore += 0.05;
  } else if (exercise.difficulty === 'INTERMEDIATE') {
    totalScore += 0.03;
  }

  // 4. Golf relevance bonus
  if (exercise.golfRelevance.length > 0) {
    totalScore += 0.05 * Math.min(exercise.golfRelevance.length, 2);
  }

  // Normalize to 0-1
  const normalizedScore = Math.min(1.0, totalScore);

  return { score: Math.round(normalizedScore * 100) / 100, reasons };
}

// ---------------------------------------------------------------------------
// Progression / regression from history
// ---------------------------------------------------------------------------

/**
 * Check if user should progress or regress an exercise based on history.
 * Returns the exercise to use (may be a progression/regression).
 */
function checkProgression(
  exercise: Exercise,
  library: Exercise[],
  history: TrainingHistory,
): Exercise {
  if (history.completedPlans.length === 0) return exercise;

  // Count recent feedback for this exercise
  let tooEasyCount = 0;
  let painCount = 0;

  // Look at last 3 plans
  const recentPlans = history.completedPlans.slice(0, 3);
  for (const plan of recentPlans) {
    for (const completion of plan.exerciseCompletions) {
      if (completion.exerciseId === exercise.id) {
        if (completion.userFeedback === 'TOO_EASY') tooEasyCount++;
        if (completion.painDuringExercise) painCount++;
      }
    }
  }

  // Pain → try regression
  if (painCount >= 1 && exercise.regressions.length > 0) {
    const regression = library.find(ex => ex.id === exercise.regressions[0]);
    if (regression) return regression;
  }

  // Consistently too easy → try progression
  if (tooEasyCount >= 2 && exercise.progressions.length > 0) {
    const progression = library.find(ex => ex.id === exercise.progressions[0]);
    if (progression) return progression;
  }

  return exercise;
}

// ---------------------------------------------------------------------------
// Dose adjustment
// ---------------------------------------------------------------------------

/**
 * Adjust exercise dose based on daily state.
 */
function adjustDose(defaultDose: ExerciseDose, state: DailyState): ExerciseDose {
  const dose = { ...defaultDose };

  switch (state.bodyFeel) {
    case 'FRESH':
      // Slightly increase
      if (dose.reps) dose.reps = Math.min(dose.reps + 2, 15);
      break;
    case 'NORMAL':
      // Keep default
      break;
    case 'STIFF':
      // Increase hold time for mobility, reduce reps for strength
      if (dose.holdSeconds) dose.holdSeconds = Math.min(dose.holdSeconds + 2, 10);
      if (dose.reps) dose.reps = Math.max(dose.reps - 2, 4);
      break;
    case 'TIRED':
      // Reduce everything
      dose.sets = Math.max(dose.sets - 1, 1);
      if (dose.reps) dose.reps = Math.max(dose.reps - 2, 4);
      break;
    case 'SORE':
      // Significantly reduce
      dose.sets = Math.max(dose.sets - 1, 1);
      if (dose.reps) dose.reps = Math.max(dose.reps - 3, 3);
      if (dose.rpe) dose.rpe = Math.max(dose.rpe - 2, 1);
      break;
  }

  // Readiness-based fine-tuning
  if (state.perceivedReadiness <= 2 && dose.sets > 1) {
    dose.sets = Math.max(dose.sets - 1, 1);
  }

  return dose;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Matches exercises from library against training priorities.
 *
 * PURE FUNCTION — same input → same output.
 */
export function matchExercises(
  priorities: TrainingPriority[],
  library: Exercise[],
  state: DailyState,
  history: TrainingHistory,
): ExerciseMatch[] {
  if (priorities.length === 0 || library.length === 0) return [];

  // 1. Filter out contraindicated exercises
  const blocked = getContraindicatedTags(state);
  const safeExercises = library.filter(ex =>
    !ex.contraindicationTags.some(tag => blocked.has(tag))
  );

  // 2. Score each exercise
  const scored: ExerciseMatch[] = safeExercises.map(exercise => {
    // Check if we should progress/regress
    const actualExercise = checkProgression(exercise, library, history);

    // Score against priorities
    const { score, reasons } = scoreExercise(actualExercise, priorities);

    // Adjust dose for today's state
    const adjustedDose = adjustDose(actualExercise.defaultDose, state);

    return {
      exercise: actualExercise,
      matchScore: score,
      matchReasons: reasons,
      adjustedDose,
    };
  });

  // 3. Filter out zero-score matches
  const meaningful = scored.filter(m => m.matchScore > 0);

  // 4. Sort by matchScore descending
  return meaningful.sort((a, b) => b.matchScore - a.matchScore);
}
