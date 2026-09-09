/**
 * Thoracic Rotation Metrics
 *
 * Computes 3D/2D biomechanical angles for the Thoracic (Trunk) Rotation protocol.
 * Calculates shoulder rotation, pelvic rotation, isolated thoracic separation,
 * lateral tilt (shoulder dip), and rotation asymmetry.
 *
 * @module thoracic-rotation-metrics
 * @version THORACIC_ROTATION_METRICS_V1
 */

import { Landmark, LandmarkId } from '../types/landmark';

export const VERSION = 'THORACIC_ROTATION_METRICS_V1';

export interface RotationSample {
  timestampMs: number;
  frameId: number;
  shoulderRotation: number;    // Positive = LEFT, Negative = RIGHT (degrees)
  pelvicRotation: number;      // Positive = LEFT, Negative = RIGHT (degrees)
  isolatedThoracic: number;    // shoulderRotation - pelvicRotation (degrees)
  lateralTilt: number;         // Shoulder dip in XY plane (degrees)
}

export interface ThoracicRotationResult {
  maxRotationLeft: number;            // Peak isolated thoracic turn Left (degrees >= 0)
  maxRotationRight: number;           // Peak isolated thoracic turn Right (degrees >= 0)
  rotationAsymmetry: number;          // |Left - Right| difference (degrees >= 0)
  totalShoulderTurnLeft: number;      // Raw shoulder angle Left (degrees >= 0)
  totalShoulderTurnRight: number;     // Raw shoulder angle Right (degrees >= 0)
  pelvicTurnAtPeakLeft: number;       // Pelvic turn at peak Left (degrees >= 0)
  pelvicTurnAtPeakRight: number;      // Pelvic turn at peak Right (degrees >= 0)
  compensations: {
    excessiveLateralTilt: boolean;    // Shoulder dip > 12° during rotation
    excessivePelvicRotation: boolean; // Hips rotate > 25° (poor disassociation)
    severeAsymmetry: boolean;         // Asymmetry > 15° between Left & Right
  };
  endpointLeftFrameId?: number;
  endpointRightFrameId?: number;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Computes transverse plane (XZ) rotation angle of a landmark pair.
 * Positive = rotated toward user's Left.
 * Negative = rotated toward user's Right.
 */
export function calculateTransverseRotation(
  leftLandmark: { x: number; z?: number },
  rightLandmark: { x: number; z?: number }
): number {
  const dx = Math.abs(rightLandmark.x - leftLandmark.x);
  const zLeft = leftLandmark.z ?? 0;
  const zRight = rightLandmark.z ?? 0;
  const dz = zLeft - zRight; // If left shoulder moves back (+z) and right forward (-z), dz > 0 (turn left)

  // Avoid division by zero when points are identical
  if (dx < 0.0001 && Math.abs(dz) < 0.0001) return 0;

  return toDegrees(Math.atan2(dz, dx));
}

/**
 * Computes frontal plane (XY) lateral tilt / dip of shoulders.
 * Neutral horizontal = 0°.
 */
export function calculateFrontalTilt(
  leftShoulder: { x: number; y: number },
  rightShoulder: { x: number; y: number }
): number {
  const dx = rightShoulder.x - leftShoulder.x;
  const dy = rightShoulder.y - leftShoulder.y;
  return toDegrees(Math.atan2(dy, dx));
}

/**
 * Extracts a single instantaneous sample of rotation kinematics from a frame.
 */
export function extractRotationSample(
  landmarks: Landmark[],
  frameId: number,
  timestampMs: number
): RotationSample | null {
  const leftShoulder = landmarks.find((l) => l.id === LandmarkId.LEFT_SHOULDER);
  const rightShoulder = landmarks.find((l) => l.id === LandmarkId.RIGHT_SHOULDER);
  const leftHip = landmarks.find((l) => l.id === LandmarkId.LEFT_HIP);
  const rightHip = landmarks.find((l) => l.id === LandmarkId.RIGHT_HIP);

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  const shoulderRot = calculateTransverseRotation(leftShoulder, rightShoulder);
  const pelvicRot = calculateTransverseRotation(leftHip, rightHip);
  const isolated = shoulderRot - pelvicRot;
  const tilt = calculateFrontalTilt(leftShoulder, rightShoulder);

  return {
    timestampMs,
    frameId,
    shoulderRotation: shoulderRot,
    pelvicRotation: pelvicRot,
    isolatedThoracic: isolated,
    lateralTilt: tilt,
  };
}

/**
 * Aggregates samples across a complete Thoracic Rotation test session
 * and computes peak metrics and compensations.
 */
export function summarizeThoracicRotation(samples: RotationSample[]): ThoracicRotationResult {
  if (samples.length === 0) {
    return {
      maxRotationLeft: 0,
      maxRotationRight: 0,
      rotationAsymmetry: 0,
      totalShoulderTurnLeft: 0,
      totalShoulderTurnRight: 0,
      pelvicTurnAtPeakLeft: 0,
      pelvicTurnAtPeakRight: 0,
      compensations: {
        excessiveLateralTilt: false,
        excessivePelvicRotation: false,
        severeAsymmetry: false,
      },
    };
  }

  let peakLeftSample = samples[0];
  let peakRightSample = samples[0];
  let maxTilt = 0;

  for (const s of samples) {
    // Left turn (positive isolatedThoracic)
    if (s.isolatedThoracic > peakLeftSample.isolatedThoracic) {
      peakLeftSample = s;
    }
    // Right turn (negative isolatedThoracic)
    if (s.isolatedThoracic < peakRightSample.isolatedThoracic) {
      peakRightSample = s;
    }
    const absTilt = Math.abs(s.lateralTilt);
    if (absTilt > maxTilt) {
      maxTilt = absTilt;
    }
  }

  const maxLeft = Math.max(0, peakLeftSample.isolatedThoracic);
  const maxRight = Math.max(0, -peakRightSample.isolatedThoracic);
  const asymmetry = Math.abs(maxLeft - maxRight);

  const rawShoulderLeft = Math.max(0, peakLeftSample.shoulderRotation);
  const rawShoulderRight = Math.max(0, -peakRightSample.shoulderRotation);
  const pelvicLeft = Math.abs(peakLeftSample.pelvicRotation);
  const pelvicRight = Math.abs(peakRightSample.pelvicRotation);

  const excessivePelvic = pelvicLeft > 25 || pelvicRight > 25;
  const excessiveTilt = maxTilt > 12;
  const severeAsymmetry = asymmetry > 15;

  return {
    maxRotationLeft: Number(maxLeft.toFixed(1)),
    maxRotationRight: Number(maxRight.toFixed(1)),
    rotationAsymmetry: Number(asymmetry.toFixed(1)),
    totalShoulderTurnLeft: Number(rawShoulderLeft.toFixed(1)),
    totalShoulderTurnRight: Number(rawShoulderRight.toFixed(1)),
    pelvicTurnAtPeakLeft: Number(pelvicLeft.toFixed(1)),
    pelvicTurnAtPeakRight: Number(pelvicRight.toFixed(1)),
    compensations: {
      excessiveLateralTilt: excessiveTilt,
      excessivePelvicRotation: excessivePelvic,
      severeAsymmetry,
    },
    endpointLeftFrameId: peakLeftSample.frameId,
    endpointRightFrameId: peakRightSample.frameId,
  };
}
