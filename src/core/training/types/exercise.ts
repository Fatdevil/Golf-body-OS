/**
 * Exercise — A single exercise in the curated library.
 *
 * Every exercise is structured data with:
 * - Category aligned with body domains
 * - Target findings it addresses
 * - Contraindications (when NOT to prescribe)
 * - Progression/regression paths
 * - Default dose (sets, reps, tempo)
 * - Golf-specific relevance
 *
 * The training engine selects exercises based on these properties.
 * AI explains the selection — AI does NOT invent exercises.
 *
 * @module exercise
 */

// ---------------------------------------------------------------------------
// Exercise category
// ---------------------------------------------------------------------------

/** Exercise category — aligned with body domains + recovery */
export type ExerciseCategory =
  | 'MOBILITY'     // ROM improvement
  | 'CONTROL'      // Motor control / stability
  | 'STRENGTH'     // Load tolerance / capacity
  | 'RECOVERY'     // Active recovery / cool-down
  | 'POWER';       // Optional — explosive / speed (future)

// ---------------------------------------------------------------------------
// Body region
// ---------------------------------------------------------------------------

/** Anatomical regions an exercise targets */
export type BodyRegion =
  | 'HIP'
  | 'THORACIC'
  | 'LUMBAR'
  | 'SHOULDER'
  | 'ANKLE'
  | 'KNEE'
  | 'CORE'
  | 'GLUTE'
  | 'HAMSTRING'
  | 'QUADRICEP'
  | 'CALF';

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

/** Equipment required for an exercise */
export type Equipment =
  | 'NONE'
  | 'WALL'
  | 'CLUB'
  | 'FOAM_ROLLER'
  | 'RESISTANCE_BAND'
  | 'BENCH'
  | 'CHAIR';

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

/** Exercise difficulty level */
export type ExerciseDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

// ---------------------------------------------------------------------------
// Exercise dose
// ---------------------------------------------------------------------------

/**
 * Dose = how much of an exercise to perform.
 *
 * Two people can get the same exercise but with different doses.
 * Exercise selection and dose selection are separate decisions.
 */
export interface ExerciseDose {
  /** Number of sets */
  sets: number;

  /** Number of reps per set (null for timed exercises) */
  reps: number | null;

  /** Hold duration in seconds per rep (for isometric holds) */
  holdSeconds: number | null;

  /** Tempo description, e.g. "3 sec down, 1 sec up" */
  tempoDescription: { sv: string; en: string } | null;

  /** Rest between sets in seconds */
  restSeconds: number;

  /** Target Rate of Perceived Exertion (1-10, null if not applicable) */
  rpe: number | null;
}

// ---------------------------------------------------------------------------
// Golf relevance
// ---------------------------------------------------------------------------

/** How an exercise relates to a specific golf swing fault */
export interface GolfRelevance {
  /** Swing fault ID, e.g. 'EARLY_EXTENSION', 'REVERSE_SPINE_ANGLE' */
  swingFault: string;

  /** Explanation of the connection */
  explanation: { sv: string; en: string };
}

// ---------------------------------------------------------------------------
// Media assets
// ---------------------------------------------------------------------------

/** Media assets for an exercise */
export interface ExerciseMedia {
  /** Thumbnail image URL/path */
  thumbnailUrl: string | null;

  /** Video demonstration URL/path */
  videoUrl: string | null;

  /** Animation URL/path (for looping previews) */
  animationUrl: string | null;
}

// ---------------------------------------------------------------------------
// Coaching cue points
// ---------------------------------------------------------------------------

/** A coaching cue at a specific moment in the exercise */
export interface CuePoint {
  /** Seconds into the exercise */
  atSecond: number;

  /** What to cue */
  cue: { sv: string; en: string };
}

// ---------------------------------------------------------------------------
// Exercise (the main entity)
// ---------------------------------------------------------------------------

/** A single exercise in the curated library */
export interface Exercise {
  /** Unique exercise ID, e.g. 'hip-90-90-rotation' */
  id: string;

  /** Human-readable name */
  name: { sv: string; en: string };

  /** Category aligned with body domains */
  category: ExerciseCategory;

  /** Anatomical regions targeted */
  bodyRegions: BodyRegion[];

  /** Finding IDs this exercise addresses */
  targetFindings: string[];

  /** Difficulty level */
  difficulty: ExerciseDifficulty;

  /** Required equipment */
  equipment: Equipment[];

  /** Default prescription */
  defaultDose: ExerciseDose;

  /** Estimated total duration in seconds (including rest) */
  estimatedDurationSec: number;

  /** Skip this exercise if user has pain in these regions */
  contraindicationTags: string[];

  /** Easier alternative exercise IDs */
  regressions: string[];

  /** Harder alternative exercise IDs */
  progressions: string[];

  /** How this exercise relates to golf performance */
  golfRelevance: GolfRelevance[];

  /** Finding IDs this exercise is especially good for */
  compatibleFindings: string[];

  /** Finding IDs where this exercise should NOT be used */
  incompatibleFindings: string[];

  /** Media assets */
  media: ExerciseMedia;

  /** Step-by-step instructions */
  instructions: { sv: string; en: string };

  /** Coaching cue points during execution */
  cuePoints: CuePoint[];
}
