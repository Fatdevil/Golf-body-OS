/**
 * Landmark Validator — Checks frame quality against protocol requirements.
 *
 * Validates that required near-side landmarks meet minimum visibility
 * thresholds. Far-side landmarks are used opportunistically but not required.
 *
 * @module landmark-validator
 * @version LANDMARK_VALIDATOR_V1
 */

import { Landmark, LandmarkId } from '../../types/landmark';
import { PoseFrame } from '../../types/pose-frame';
import { TestProtocol } from '../../types/protocol';

export const VERSION = 'LANDMARK_VALIDATOR_V1';

/** Result of frame validation */
export type ValidationResult =
  | { valid: true; frame: PoseFrame; nearSideConfidence: number }
  | { valid: false; reason: string; missingLandmarks: LandmarkId[] };

/**
 * Validates a pose frame against a test protocol's requirements.
 *
 * Checks that all required near-side landmarks are visible above
 * the protocol's minimum visibility threshold. Far-side landmarks
 * are tracked but not required (correction #6).
 *
 * @param frame - The pose frame to validate
 * @param protocol - The test protocol defining requirements
 * @returns ValidationResult indicating whether the frame is usable
 */
export function validateFrame(
  frame: PoseFrame,
  protocol: TestProtocol,
): ValidationResult {
  const missingLandmarks: LandmarkId[] = [];
  let totalVisibility = 0;
  let landmarkCount = 0;

  for (const requiredId of protocol.requiredNearSideLandmarks) {
    const landmark = frame.landmarks.find((l) => l.id === requiredId);

    if (!landmark) {
      missingLandmarks.push(requiredId);
      continue;
    }

    const visibility = landmark.visibility ?? 0;
    if (visibility < protocol.minVisibility) {
      missingLandmarks.push(requiredId);
    }

    totalVisibility += visibility;
    landmarkCount++;
  }

  if (missingLandmarks.length > 0) {
    return {
      valid: false,
      reason: `Missing or low-visibility near-side landmarks: [${missingLandmarks.join(', ')}]`,
      missingLandmarks,
    };
  }

  const nearSideConfidence = landmarkCount > 0 ? totalVisibility / landmarkCount : 0;

  return {
    valid: true,
    frame,
    nearSideConfidence,
  };
}

/**
 * Validates a sequence of frames and returns only the valid ones.
 *
 * @param frames - Array of pose frames
 * @param protocol - Test protocol
 * @returns Object with valid frames and rejection stats
 */
export function validateSequence(
  frames: PoseFrame[],
  protocol: TestProtocol,
): {
  validFrames: PoseFrame[];
  rejectedCount: number;
  validRatio: number;
  averageNearSideConfidence: number;
} {
  const validFrames: PoseFrame[] = [];
  let rejectedCount = 0;
  let totalConfidence = 0;

  for (const frame of frames) {
    const result = validateFrame(frame, protocol);
    if (result.valid) {
      validFrames.push(result.frame);
      totalConfidence += result.nearSideConfidence;
    } else {
      rejectedCount++;
    }
  }

  return {
    validFrames,
    rejectedCount,
    validRatio: frames.length > 0 ? validFrames.length / frames.length : 0,
    averageNearSideConfidence:
      validFrames.length > 0 ? totalConfidence / validFrames.length : 0,
  };
}
