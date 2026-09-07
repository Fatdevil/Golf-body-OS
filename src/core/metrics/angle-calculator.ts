/**
 * Angle Calculator — Pure math functions for body angle measurement.
 *
 * All calculations operate in BODY_METRIC space (gravity-aligned, Y points UP).
 * No dependencies on MediaPipe, React Native, or native modules.
 *
 * @module angle-calculator
 * @version ANGLE_CALCULATOR_V1
 */

export const VERSION = 'ANGLE_CALCULATOR_V1';

/** 2D point */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Euclidean distance between two 2D points.
 */
export function distance2D(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Angle of a 2D vector from the positive X axis, in degrees [-180, 180].
 */
export function vectorAngle(v: Point2D): number {
  return Math.atan2(v.y, v.x) * (180 / Math.PI);
}

/**
 * Interior angle at vertex B, given points A → B → C.
 * Uses atan2 for robustness. Returns degrees [0, 180].
 *
 * @param a - First point
 * @param b - Vertex point (where the angle is measured)
 * @param c - Third point
 * @returns Angle in degrees [0, 180]. Returns 0 for degenerate cases.
 */
export function interiorAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);

  if (magBA < 1e-10 || magBC < 1e-10) return 0;

  const dot = ba.x * bc.x + ba.y * bc.y;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magBA * magBC)));

  return Math.acos(cosTheta) * (180 / Math.PI);
}

/**
 * Trunk inclination: angle between shoulder→hip vector and vertical.
 * 0° = standing upright, 90° = torso horizontal.
 *
 * In BODY_METRIC space, Y points UP, so a vertical trunk has
 * shoulder directly above hip (shoulder.y > hip.y).
 *
 * @param shoulder - Shoulder position in BODY_METRIC space
 * @param hip - Hip position in BODY_METRIC space
 * @returns Angle from vertical in degrees [0, 180]
 */
export function trunkInclination(shoulder: Point2D, hip: Point2D): number {
  // Vector from hip to shoulder
  const dx = shoulder.x - hip.x;
  const dy = shoulder.y - hip.y;

  const magnitude = Math.sqrt(dx ** 2 + dy ** 2);
  if (magnitude < 1e-10) return 0;

  // In BODY_METRIC space, Y is UP. Vertical vector is (0, 1).
  // Dot product with (0, 1) is just dy.
  const cosTheta = Math.max(-1, Math.min(1, dy / magnitude));

  return Math.acos(cosTheta) * (180 / Math.PI);
}

/**
 * Shank (tibia) inclination: angle of knee→ankle segment from vertical.
 * 0° = perfectly vertical tibia, >0° = forward lean.
 *
 * In BODY_METRIC space, Y points UP, so vertical tibia has
 * knee directly above ankle (knee.y > ankle.y).
 *
 * @param knee - Knee position in BODY_METRIC space
 * @param ankle - Ankle position in BODY_METRIC space
 * @returns Angle from vertical in degrees [0, 180]
 */
export function shankInclination(knee: Point2D, ankle: Point2D): number {
  // Vector from ankle to knee (pointing up in normal stance)
  const dx = knee.x - ankle.x;
  const dy = knee.y - ankle.y;

  const magnitude = Math.sqrt(dx ** 2 + dy ** 2);
  if (magnitude < 1e-10) return 0;

  // Vertical vector is (0, 1) in BODY_METRIC space
  const cosTheta = Math.max(-1, Math.min(1, dy / magnitude));

  return Math.acos(cosTheta) * (180 / Math.PI);
}

/**
 * Normalized posterior hip shift relative to ankle.
 * Positive value = hips behind ankle (correct hip hinge pattern).
 *
 * @param hip - Hip position
 * @param ankle - Ankle position
 * @param legLength - Combined thigh + shank length for normalization
 * @param facingRight - True if person faces +X direction
 * @returns Normalized shift. Positive = posterior (behind), negative = anterior (forward).
 */
export function posteriorHipShift(
  hip: Point2D,
  ankle: Point2D,
  legLength: number,
  facingRight: boolean,
): number {
  if (legLength < 1e-10) return 0;

  // Horizontal distance: hip relative to ankle
  const horizontalDiff = hip.x - ankle.x;

  // If facing right, posterior is in -X direction (hip behind ankle = hip.x < ankle.x)
  // If facing left, posterior is in +X direction (hip behind ankle = hip.x > ankle.x)
  const posteriorShift = facingRight ? -horizontalDiff : horizontalDiff;

  return posteriorShift / legLength;
}

/**
 * The 2D shoulder→hip→knee angle for hip hinge assessment.
 *
 * This is explicitly named HIP_HINGE_ANGLE_2D (NOT "hip flexion ROM")
 * because it measures a 2D projection angle that has not been validated
 * against reference measurement systems. It is EXPERIMENTAL.
 *
 * Standing: ≈180° (shoulder, hip, knee roughly aligned)
 * Full hinge: ≈70–90° (trunk forward, legs relatively straight)
 *
 * @param shoulder - Shoulder position
 * @param hip - Hip position (vertex)
 * @param knee - Knee position
 * @returns Interior angle at hip in degrees [0, 180]
 */
export function calculateHipHingeAngle2D(
  shoulder: Point2D,
  hip: Point2D,
  knee: Point2D,
): number {
  return interiorAngle(shoulder, hip, knee);
}
