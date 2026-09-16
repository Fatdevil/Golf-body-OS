/**
 * Training Engine V1 — Domain & Decision Spec
 *
 * Central re-export of all training domain types and engine contracts.
 *
 * Architecture:
 *   BODY PROFILE + DAILY STATE + GOLF CONTEXT
 *                     ↓
 *           buildDailyPlan()  ← pure function
 *                     ↓
 *               DAILY PLAN
 *
 * @module training
 */

// ── Domain types ──────────────────────────────────────────────────────────

// Shared enums (used across multiple types)
export type { BodyDomain } from './types/shared-enums';

// Body Profile
export type {
  AssessmentConfidence,
  AreaQuality,
  GolfBodyTier,
  AreaScore,
  AssessmentSource,
  DomainAssessment,
  BodyProfile,
} from './types/body-profile';

// Body Finding
export type {
  FindingType,
  FindingSeverity,
  FindingConfidence,
  BodyFinding,
} from './types/body-finding';

// Daily State
export type {
  BodyFeel,
  PainRegion,
  PainIntensity,
  PainArea,
  PerceivedReadiness,
  DailyState,
} from './types/daily-state';

// Golf Context
export type {
  GolfActivity,
  FocusMode,
  GolfContext,
} from './types/golf-context';

// Exercise
export type {
  ExerciseCategory,
  BodyRegion,
  Equipment,
  ExerciseDifficulty,
  ExerciseDose,
  GolfRelevance,
  ExerciseMedia,
  CuePoint,
  Exercise,
} from './types/exercise';

// Daily Plan
export type {
  ExerciseAssignment,
  PlanDistribution,
  DailyPlan,
} from './types/daily-plan';

// Training History
export type {
  ExerciseFeedback,
  PlanFeedback,
  ExerciseCompletion,
  DailyPlanCompletion,
  TrainingHistory,
} from './types/training-history';

// ── Engine ────────────────────────────────────────────────────────────────

// Priority Calculator
export type { TrainingPriority } from './engine/priority-calculator';
export { calculatePriorities } from './engine/priority-calculator';

// Exercise Matcher
export type { ExerciseMatch } from './engine/exercise-matcher';
export { matchExercises } from './engine/exercise-matcher';

// Time Packer
export { packExercisesIntoTime } from './engine/time-packer';

// Plan Builder (top-level orchestrator)
export { buildDailyPlan } from './engine/plan-builder';

// ── Data ──────────────────────────────────────────────────────────────────

// Exercise Library
export {
  EXERCISE_LIBRARY,
  EXERCISE_BY_ID,
  LIBRARY_VERSION,
  getExercisesByCategory,
  getExercisesForFinding,
} from './data/exercise-library';

// ── Adapters ──────────────────────────────────────────────────────────────

// Screening → BodyProfile bridge
export { screeningToProfile } from './adapters/screening-to-profile';
