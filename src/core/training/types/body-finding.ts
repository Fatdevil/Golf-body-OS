/**
 * Body Finding — Structured evidence from body assessments.
 *
 * Findings are the intermediate layer between raw test results
 * and training decisions. They capture WHAT was observed, not
 * what to do about it.
 *
 * Example: "Limited hip internal rotation on left side"
 *          "Compensatory knee strategy during hip hinge"
 *          "Strong thoracic rotation symmetry"
 *
 * @module body-finding
 */

import type { BodyDomain } from './shared-enums';

// ---------------------------------------------------------------------------
// Finding types
// ---------------------------------------------------------------------------

/** What kind of finding this is */
export type FindingType =
  | 'LIMITATION'     // ROM or capability deficit
  | 'COMPENSATION'   // Movement strategy that bypasses a limitation
  | 'ASYMMETRY'      // Left/right imbalance
  | 'STRENGTH';      // Something the person does well

/** How significant is this finding */
export type FindingSeverity = 'MILD' | 'MODERATE' | 'SIGNIFICANT';

/** Confidence in the finding */
export type FindingConfidence = 'HIGH' | 'MODERATE' | 'LOW';

// ---------------------------------------------------------------------------
// Body Finding
// ---------------------------------------------------------------------------

/** A specific finding from body assessment */
export interface BodyFinding {
  /** Unique finding ID, e.g. 'hip-rotation-left-limited' */
  id: string;

  /** Which domain this finding belongs to */
  domain: BodyDomain;

  /** Which area within the domain, e.g. 'hipRotation' */
  areaId: string;

  /** What kind of finding */
  type: FindingType;

  /** How significant */
  severity: FindingSeverity;

  /** Human-readable label */
  label: { sv: string; en: string };

  /** Detailed description */
  description: { sv: string; en: string };

  /** Tags that match to compatible exercises */
  compatibleExerciseTags: string[];

  /** Confidence in this finding */
  confidence: FindingConfidence;
}
