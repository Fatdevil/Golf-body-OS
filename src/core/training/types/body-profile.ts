/**
 * Body Profile — The structured truth about a person's physical capabilities.
 *
 * Four domains: MOBILITY, MOTOR_CONTROL, CAPACITY, POWER.
 * Each domain contains per-area scores with timestamps and confidence.
 *
 * GolfBodyScore is a computed view on top of this — never the primary data.
 *
 * @module body-profile
 */

import type { BodyFinding } from './body-finding';
import type { BodyDomain } from './shared-enums';

// Re-export for convenience
export type { BodyDomain } from './shared-enums';

// ---------------------------------------------------------------------------
// Domain taxonomy
// ---------------------------------------------------------------------------

/** Confidence in an assessment */
export type AssessmentConfidence = 'HIGH' | 'MODERATE' | 'LOW';

/** Quality rating for a specific area */
export type AreaQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

/** Golf Body tier — computed from composite score */
export type GolfBodyTier = 'TOUR_ELITE' | 'SOLID' | 'MODERATE' | 'RESTRICTED';

// ---------------------------------------------------------------------------
// Area scores (within a domain)
// ---------------------------------------------------------------------------

/** A specific measured area within a domain (e.g. "hipRotation") */
export interface AreaScore {
  /** Unique area identifier, e.g. 'hipRotation', 'thoracicRotation', 'singleLegBalance' */
  areaId: string;

  /** Human-readable label */
  label: { sv: string; en: string };

  /** Score within this area */
  score: number;

  /** Maximum possible score */
  maxScore: number;

  /** Quality assessment */
  quality: AreaQuality;

  /** Raw measurement values, e.g. { leftDeg: 38, rightDeg: 42 } */
  rawMeasurements: Record<string, number>;

  /** Detected compensations (technical IDs) */
  compensations: string[];

  /** When this specific area was last tested */
  lastTestedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Domain assessment
// ---------------------------------------------------------------------------

/** How the assessment was obtained */
export type AssessmentSource = 'SCREENING' | 'TARGETED_RETEST' | 'INFERRED';

/** Status of the assessment to prevent acting on missing data */
export type AssessmentStatus = 'NOT_TESTED' | 'MEASURED' | 'DERIVED';

/** A single domain assessment within the body profile */
export interface DomainAssessment {
  /** Which domain this assesses */
  domain: BodyDomain;

  /** Status of this domain (NOT_TESTED domains are skipped by priority engine) */
  status: AssessmentStatus;

  /** Per-area scores within this domain */
  areas: AreaScore[];

  /** Composite score 0-100 for this domain */
  compositeScore: number;

  /** Confidence in this assessment */
  confidence: AssessmentConfidence;

  /** When this domain was last tested (most recent area test) */
  lastTestedAt: Date | null;

  /** How this assessment was obtained */
  source: AssessmentSource;
}

// ---------------------------------------------------------------------------
// Body Profile (the top-level entity)
// ---------------------------------------------------------------------------

/** Complete body profile — the structured truth about this person's body */
export interface BodyProfile {
  /** Unique profile ID */
  id: string;

  /** User this profile belongs to */
  userId: string;

  /** When this profile was first created */
  createdAt: Date;

  /** When any domain was last updated */
  updatedAt: Date;

  // ── Domain assessments ──────────────────────────────────────────────
  /** Mobility: can the joints reach the required ROM? */
  mobility: DomainAssessment;

  /** Motor Control: can the person control the movement? */
  motorControl: DomainAssessment;

  /** Capacity (formerly Load Tolerance): can the body work under load for reps/time? */
  capacity: DomainAssessment;

  /** Power (Optional): can the body produce force explosively? */
  power: DomainAssessment;

  // ── Computed views (derived, not primary data) ──────────────────────
  /** Golf Body Score — a compressed 0-100 view of the profile */
  golfBodyScore: number;

  /** Performance tier */
  golfBodyTier: GolfBodyTier;

  // ── Derived analysis ────────────────────────────────────────────────
  /** Identified limitations and problems */
  primaryBottlenecks: BodyFinding[];

  /** Identified strengths */
  keyStrengths: BodyFinding[];
}
