/**
 * Golf Club Spatial State & Orientation
 *
 * Defines the 3D position of the golf club (grip point, clubhead, shaft angle,
 * and face angle) synchronized with biomechanical PoseFrames.
 *
 * @module club-frame
 */

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface ClubState {
  /** Grip position (hands midpoint) */
  grip: Point3D;
  /** Clubhead position in normalized coordinates */
  clubHead: Point3D;
  /** Angle of the shaft relative to horizontal ground (0° = parallel, 90° = vertical) */
  shaftAngleDeg: number;
  /** Clubface angle relative to swing plane (0° = square, + = open, - = closed) */
  faceAngleDeg?: number;
  /** Dynamic forward shaft lean at impact (+ towards target in degrees) */
  forwardShaftLeanDeg?: number;
  /** Confidence of detection [0.0 - 1.0] */
  confidence: number;
}

/**
 * Mirrors a ClubState across the vertical axis (X -> 1 - X) for left-handed golfers.
 */
export function mirrorClubState(club: ClubState): ClubState {
  return {
    grip: {
      x: 1 - club.grip.x,
      y: club.grip.y,
      z: club.grip.z !== undefined ? -club.grip.z : undefined
    },
    clubHead: {
      x: 1 - club.clubHead.x,
      y: club.clubHead.y,
      z: club.clubHead.z !== undefined ? -club.clubHead.z : undefined
    },
    shaftAngleDeg: club.shaftAngleDeg,
    faceAngleDeg: club.faceAngleDeg !== undefined ? -club.faceAngleDeg : undefined,
    forwardShaftLeanDeg: club.forwardShaftLeanDeg !== undefined ? -club.forwardShaftLeanDeg : undefined,
    confidence: club.confidence
  };
}
