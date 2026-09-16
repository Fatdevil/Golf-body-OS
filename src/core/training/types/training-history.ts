/**
 * Training History — Records of completed training.
 *
 * Tracks exercise completions, user feedback, streaks, and adherence.
 * Used by the engine to make progression decisions:
 * - If user consistently rates exercises "TOO_EASY" → progress
 * - If user reports pain during exercise → avoid or regress
 * - Completion rate informs adaptation at retest
 *
 * @module training-history
 */

import type { ExerciseDose } from './exercise';

// ---------------------------------------------------------------------------
// User feedback
// ---------------------------------------------------------------------------

/** User's subjective feedback after an exercise */
export type ExerciseFeedback = 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD';

/** User's overall feeling after completing a plan */
export type PlanFeedback = 'GREAT' | 'GOOD' | 'OKAY' | 'TOUGH';

// ---------------------------------------------------------------------------
// Exercise completion
// ---------------------------------------------------------------------------

/** Record of a completed (or skipped) exercise */
export interface ExerciseCompletion {
  /** Which exercise was assigned */
  exerciseId: string;

  /** The dose that was assigned */
  assignedDose: ExerciseDose;

  /** The dose actually performed (null = skipped) */
  actualDose: ExerciseDose | null;

  /** When this exercise was completed */
  completedAt: Date;

  /** User's subjective feedback */
  userFeedback: ExerciseFeedback | null;

  /** Whether pain was experienced during this exercise */
  painDuringExercise: boolean;
}

// ---------------------------------------------------------------------------
// Plan completion
// ---------------------------------------------------------------------------

/** Record of a completed daily plan */
export interface DailyPlanCompletion {
  /** Which plan was completed */
  planId: string;

  /** When the plan was completed */
  completedAt: Date;

  /** Individual exercise completion records */
  exerciseCompletions: ExerciseCompletion[];

  /** Overall session feeling */
  overallFeel: PlanFeedback | null;

  /** Exercises completed / total exercises (0.0 - 1.0) */
  completionRate: number;
}

// ---------------------------------------------------------------------------
// Training History (aggregated)
// ---------------------------------------------------------------------------

/** Aggregated training history for a user */
export interface TrainingHistory {
  /** User this history belongs to */
  userId: string;

  /** All completed plans (newest first) */
  completedPlans: DailyPlanCompletion[];

  /** Current consecutive-day streak */
  currentStreak: number;

  /** Longest ever streak */
  longestStreak: number;

  /** Total plans completed all-time */
  totalPlansCompleted: number;

  /** Last plan completion date */
  lastCompletedAt: Date | null;

  /** Average completion rate across all plans */
  averageCompletionRate: number;
}
