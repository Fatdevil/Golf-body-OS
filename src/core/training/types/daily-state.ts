/**
 * Daily State — How the body feels today.
 *
 * This is the "S" in Capability + State + Context = Plan.
 * Changes from day to day. Captured via 5-second check-in.
 *
 * If painAreas is non-empty, the training engine enters safety mode:
 * - Reduces load
 * - Avoids exercises targeting painful regions
 * - Shifts toward recovery
 * - May recommend professional assessment
 *
 * @module daily-state
 */

// ---------------------------------------------------------------------------
// Body feel
// ---------------------------------------------------------------------------

/** Overall body feel — single selection */
export type BodyFeel = 'FRESH' | 'NORMAL' | 'STIFF' | 'TIRED' | 'SORE';

// ---------------------------------------------------------------------------
// Pain tracking (wellness, not medical)
// ---------------------------------------------------------------------------

/** Body regions where discomfort can be reported */
export type PainRegion =
  | 'LOWER_BACK'
  | 'UPPER_BACK'
  | 'NECK'
  | 'SHOULDER_LEFT'
  | 'SHOULDER_RIGHT'
  | 'HIP_LEFT'
  | 'HIP_RIGHT'
  | 'KNEE_LEFT'
  | 'KNEE_RIGHT'
  | 'ANKLE_LEFT'
  | 'ANKLE_RIGHT'
  | 'OTHER';

/** Intensity of discomfort */
export type PainIntensity = 'MILD' | 'MODERATE' | 'SIGNIFICANT';

/** A reported area of discomfort */
export interface PainArea {
  region: PainRegion;
  intensity: PainIntensity;
}

// ---------------------------------------------------------------------------
// Perceived readiness
// ---------------------------------------------------------------------------

/** Self-rated readiness (1 = very low, 5 = fully recovered) */
export type PerceivedReadiness = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Daily State (the composite)
// ---------------------------------------------------------------------------

/** How the body feels today — captured in ~5 seconds */
export interface DailyState {
  /** Overall body feel */
  bodyFeel: BodyFeel;

  /** Optional pain/discomfort areas — triggers safety mode if non-empty */
  painAreas: PainArea[];

  /** Overall perceived readiness 1-5 */
  perceivedReadiness: PerceivedReadiness;

  /** When this was recorded */
  recordedAt: Date;
}
