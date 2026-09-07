/**
 * Velocity Calculator — Angular velocity from consecutive pose frames.
 *
 * Computes angular velocity (°/s) for tracked joint angles between
 * consecutive smoothed frames. Used by the Phase Engine to detect
 * movement transitions (zero-crossings, threshold triggers).
 *
 * @module velocity-calculator
 * @version VELOCITY_CALCULATOR_V1
 */

export const VERSION = 'VELOCITY_CALCULATOR_V1';

/** A single velocity data point */
export interface VelocityPoint {
  /** Frame ID */
  frameId: number;
  /** Timestamp in milliseconds */
  timestampMs: number;
  /** Angular velocity in degrees per second */
  velocityDegPerSec: number;
}

/**
 * Calculates angular velocity between two consecutive angle measurements.
 *
 * @param angle1 - Angle at time t1 (degrees)
 * @param angle2 - Angle at time t2 (degrees)
 * @param t1Ms - Timestamp of first measurement (milliseconds)
 * @param t2Ms - Timestamp of second measurement (milliseconds)
 * @returns Angular velocity in degrees per second. Negative = angle decreasing (e.g., hip flexing).
 */
export function calculateAngularVelocity(
  angle1: number,
  angle2: number,
  t1Ms: number,
  t2Ms: number,
): number {
  const dtSec = (t2Ms - t1Ms) / 1000;
  if (dtSec <= 0) return 0;
  return (angle2 - angle1) / dtSec;
}

/**
 * Detects zero-crossings in an angular velocity series.
 * A zero-crossing indicates a direction change (e.g., descent → endpoint).
 *
 * @param velocities - Array of velocity points
 * @returns Indices where sign changes occur
 */
export function detectZeroCrossings(velocities: VelocityPoint[]): number[] {
  const crossings: number[] = [];

  for (let i = 1; i < velocities.length; i++) {
    const prev = velocities[i - 1]!;
    const curr = velocities[i]!;

    if (prev.velocityDegPerSec * curr.velocityDegPerSec < 0) {
      crossings.push(i);
    }
  }

  return crossings;
}

/**
 * Calculates angular velocity series from an array of angle measurements.
 *
 * @param angles - Array of { angle, frameId, timestampMs }
 * @returns Array of VelocityPoint (one fewer element than input)
 */
export function calculateVelocitySeries(
  angles: Array<{ angle: number; frameId: number; timestampMs: number }>,
): VelocityPoint[] {
  const velocities: VelocityPoint[] = [];

  for (let i = 1; i < angles.length; i++) {
    const prev = angles[i - 1]!;
    const curr = angles[i]!;

    velocities.push({
      frameId: curr.frameId,
      timestampMs: curr.timestampMs,
      velocityDegPerSec: calculateAngularVelocity(
        prev.angle,
        curr.angle,
        prev.timestampMs,
        curr.timestampMs,
      ),
    });
  }

  return velocities;
}
