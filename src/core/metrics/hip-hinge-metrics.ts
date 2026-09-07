/**
 * Hip Hinge Metrics — Per-repetition metric extraction.
 *
 * Extracts biomechanical metrics from landmark positions at the
 * endpoint of a hip hinge repetition. All angles are computed in
 * BODY_METRIC space (Y points UP).
 *
 * @module hip-hinge-metrics
 * @version HIP_HINGE_METRICS_V1
 */

import { Landmark, LandmarkId } from '../types/landmark';
import {
  interiorAngle,
  trunkInclination as calcTrunkInclination,
  shankInclination as calcShankInclination,
  posteriorHipShift as calcPosteriorHipShift,
  distance2D,
  Point2D,
} from './angle-calculator';
import { detectCompensations, type CompensationFlag, type CompensationType } from './compensation-detector';

export const VERSION = 'HIP_HINGE_METRICS_V1';

export type { CompensationFlag, CompensationType };

/** Simplified metric result for R-1A (pre-full BodyMetric integration) */
export interface MetricValue {
  id: string;
  value: number;
  unit: 'degrees' | 'meters' | 'ratio';
  validationStatus: 'EXPERIMENTAL';
}

export interface RepetitionResult {
  repNumber: number;
  hipHingeAngle2D: MetricValue;
  trunkInclination: MetricValue;
  kneeAngleAtEndpoint: MetricValue;
  shankInclination: MetricValue;
  posteriorHipShift: MetricValue;
  compensations: CompensationFlag[];
  endpointFrameRange: [number, number];
}

/**
 * Extracts a landmark by ID from an array of landmarks.
 * Returns undefined if not found.
 */
function findLandmark(landmarks: Landmark[], id: LandmarkId): Landmark | undefined {
  return landmarks.find((l) => l.id === id);
}

/**
 * Extracts per-repetition metrics for the Hip Hinge protocol.
 *
 * @param landmarks - Landmark array at the endpoint frame
 * @param baselineLandmarks - Landmark array at the baseline standing frame
 * @param endpointFrameId - Frame ID of the endpoint
 * @param side - Which side is near the camera (default: LEFT per spec)
 * @param facingRight - True if person faces +X direction in BODY_METRIC space
 */
export function extractRepMetrics(
  landmarks: Landmark[],
  baselineLandmarks: Landmark[],
  endpointFrameId: number,
  side: 'LEFT' | 'RIGHT' = 'LEFT',
  facingRight: boolean = false,
): RepetitionResult {
  const isLeft = side === 'LEFT';

  // Near-side landmark IDs
  const EAR_ID = isLeft ? LandmarkId.LEFT_EAR : LandmarkId.RIGHT_EAR;
  const SHOULDER_ID = isLeft ? LandmarkId.LEFT_SHOULDER : LandmarkId.RIGHT_SHOULDER;
  const HIP_ID = isLeft ? LandmarkId.LEFT_HIP : LandmarkId.RIGHT_HIP;
  const KNEE_ID = isLeft ? LandmarkId.LEFT_KNEE : LandmarkId.RIGHT_KNEE;
  const ANKLE_ID = isLeft ? LandmarkId.LEFT_ANKLE : LandmarkId.RIGHT_ANKLE;

  // Extract current frame landmarks
  const ear = findLandmark(landmarks, EAR_ID);
  const shoulder = findLandmark(landmarks, SHOULDER_ID);
  const hip = findLandmark(landmarks, HIP_ID);
  const knee = findLandmark(landmarks, KNEE_ID);
  const ankle = findLandmark(landmarks, ANKLE_ID);

  // Extract baseline landmarks
  const baselineHip = findLandmark(baselineLandmarks, HIP_ID);
  const baselineKnee = findLandmark(baselineLandmarks, KNEE_ID);
  const baselineAnkle = findLandmark(baselineLandmarks, ANKLE_ID);

  if (!ear || !shoulder || !hip || !knee || !ankle || !baselineHip || !baselineKnee || !baselineAnkle) {
    throw new Error('Missing required landmarks for hip hinge metrics');
  }

  // Calculate Hip Hinge Angle (Shoulder → Hip → Knee)
  const hipHingeAngle = interiorAngle(shoulder, hip, knee);

  // Calculate Trunk Inclination (Shoulder → Hip vs vertical)
  const trunkInc = calcTrunkInclination(shoulder, hip);

  // Calculate Knee Angle (Hip → Knee → Ankle)
  const kneeAngle = interiorAngle(hip, knee, ankle);

  // Calculate Shank Inclination (Knee → Ankle vs vertical)
  const shankInc = calcShankInclination(knee, ankle);

  // Calculate Neck Alignment (Ear → Shoulder → Hip)
  const neckAlignment = interiorAngle(ear, shoulder, hip);

  // BUG-9 FIX: Calculate leg length as hip→knee + knee→ankle (not straight hip→ankle)
  const thighLength = distance2D(baselineHip, baselineKnee);
  const shankLength = distance2D(baselineKnee, baselineAnkle);
  const legLength = thighLength + shankLength;

  // BUG-2 FIX: Use posteriorHipShift from angle-calculator (direction-aware)
  // instead of Math.abs which swallows direction
  const hipShift = calcPosteriorHipShift(hip, ankle, legLength, facingRight);

  const compensations = detectCompensations(
    kneeAngle,
    shankInc,
    neckAlignment,
    hipShift,
    trunkInc,
    hipHingeAngle,
  );

  return {
    repNumber: 1, // Overridden by the pipeline
    hipHingeAngle2D: {
      id: 'HIP_HINGE_ANGLE_2D',
      value: hipHingeAngle,
      unit: 'degrees',
      validationStatus: 'EXPERIMENTAL',
    },
    trunkInclination: {
      id: 'TRUNK_INCLINATION',
      value: trunkInc,
      unit: 'degrees',
      validationStatus: 'EXPERIMENTAL',
    },
    kneeAngleAtEndpoint: {
      id: 'KNEE_ANGLE_AT_ENDPOINT',
      value: kneeAngle,
      unit: 'degrees',
      validationStatus: 'EXPERIMENTAL',
    },
    shankInclination: {
      id: 'SHANK_INCLINATION',
      value: shankInc,
      unit: 'degrees',
      validationStatus: 'EXPERIMENTAL',
    },
    posteriorHipShift: {
      id: 'POSTERIOR_HIP_SHIFT',
      value: hipShift,
      unit: 'ratio',
      validationStatus: 'EXPERIMENTAL',
    },
    compensations,
    endpointFrameRange: [endpointFrameId, endpointFrameId],
  };
}
