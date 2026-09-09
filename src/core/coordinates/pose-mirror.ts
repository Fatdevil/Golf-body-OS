/**
 * Pose Mirroring Utility
 *
 * Provides functions to mirror a PoseFrame across the vertical axis (X -> 1 - X)
 * while correctly swapping bilateral anatomical landmarks (left <-> right).
 * Essential for left-handed golfers and camera mirroring modes.
 *
 * @module pose-mirror
 */

import { Landmark, LandmarkId } from '../types/landmark';
import { PoseFrame } from '../types/pose-frame';

/**
 * Bilateral landmark pairs that swap identities when mirrored horizontally.
 */
const BILATERAL_SWAP_MAP: Partial<Record<LandmarkId, LandmarkId>> = {
  // Face
  [LandmarkId.LEFT_EYE_INNER]: LandmarkId.RIGHT_EYE_INNER,
  [LandmarkId.RIGHT_EYE_INNER]: LandmarkId.LEFT_EYE_INNER,
  [LandmarkId.LEFT_EYE]: LandmarkId.RIGHT_EYE,
  [LandmarkId.RIGHT_EYE]: LandmarkId.LEFT_EYE,
  [LandmarkId.LEFT_EYE_OUTER]: LandmarkId.RIGHT_EYE_OUTER,
  [LandmarkId.RIGHT_EYE_OUTER]: LandmarkId.LEFT_EYE_OUTER,
  [LandmarkId.LEFT_EAR]: LandmarkId.RIGHT_EAR,
  [LandmarkId.RIGHT_EAR]: LandmarkId.LEFT_EAR,
  [LandmarkId.MOUTH_LEFT]: LandmarkId.MOUTH_RIGHT,
  [LandmarkId.MOUTH_RIGHT]: LandmarkId.MOUTH_LEFT,

  // Upper Body
  [LandmarkId.LEFT_SHOULDER]: LandmarkId.RIGHT_SHOULDER,
  [LandmarkId.RIGHT_SHOULDER]: LandmarkId.LEFT_SHOULDER,
  [LandmarkId.LEFT_ELBOW]: LandmarkId.RIGHT_ELBOW,
  [LandmarkId.RIGHT_ELBOW]: LandmarkId.LEFT_ELBOW,
  [LandmarkId.LEFT_WRIST]: LandmarkId.RIGHT_WRIST,
  [LandmarkId.RIGHT_WRIST]: LandmarkId.LEFT_WRIST,

  // Hands & Fingers
  [LandmarkId.LEFT_PINKY]: LandmarkId.RIGHT_PINKY,
  [LandmarkId.RIGHT_PINKY]: LandmarkId.LEFT_PINKY,
  [LandmarkId.LEFT_INDEX]: LandmarkId.RIGHT_INDEX,
  [LandmarkId.RIGHT_INDEX]: LandmarkId.LEFT_INDEX,
  [LandmarkId.LEFT_THUMB]: LandmarkId.RIGHT_THUMB,
  [LandmarkId.RIGHT_THUMB]: LandmarkId.LEFT_THUMB,

  // Lower Body
  [LandmarkId.LEFT_HIP]: LandmarkId.RIGHT_HIP,
  [LandmarkId.RIGHT_HIP]: LandmarkId.LEFT_HIP,
  [LandmarkId.LEFT_KNEE]: LandmarkId.RIGHT_KNEE,
  [LandmarkId.RIGHT_KNEE]: LandmarkId.LEFT_KNEE,
  [LandmarkId.LEFT_ANKLE]: LandmarkId.RIGHT_ANKLE,
  [LandmarkId.RIGHT_ANKLE]: LandmarkId.LEFT_ANKLE,

  // Feet
  [LandmarkId.LEFT_HEEL]: LandmarkId.RIGHT_HEEL,
  [LandmarkId.RIGHT_HEEL]: LandmarkId.LEFT_HEEL,
  [LandmarkId.LEFT_FOOT_INDEX]: LandmarkId.RIGHT_FOOT_INDEX,
  [LandmarkId.RIGHT_FOOT_INDEX]: LandmarkId.LEFT_FOOT_INDEX,
};

/**
 * Mirrors a single landmark horizontally across the normalized X = 0.5 axis.
 * Swaps bilateral landmark ID if applicable.
 */
export function mirrorLandmark(landmark: Landmark): Landmark {
  const swappedId = BILATERAL_SWAP_MAP[landmark.id] ?? landmark.id;
  return {
    ...landmark,
    id: swappedId,
    x: 1 - landmark.x,
    z: landmark.z !== undefined ? landmark.z : undefined,
  };
}

/**
 * Mirrors a full PoseFrame horizontally.
 * All landmarks have their X coordinates inverted (x' = 1 - x)
 * and bilateral IDs swapped (e.g. left shoulder becomes right shoulder).
 */
import { mirrorClubState } from '../types/club-frame';

export function mirrorPoseFrame(frame: PoseFrame): PoseFrame {
  const mirroredLandmarks = frame.landmarks.map(mirrorLandmark);

  let mirroredWorldLandmarks: Landmark[] | undefined;
  if (frame.worldLandmarks) {
    mirroredWorldLandmarks = frame.worldLandmarks.map(lm => {
      const swappedId = BILATERAL_SWAP_MAP[lm.id] ?? lm.id;
      return {
        ...lm,
        id: swappedId,
        x: -lm.x, // Metric world coords centered at 0
        z: lm.z,
      };
    });
  }

  return {
    ...frame,
    landmarks: mirroredLandmarks,
    worldLandmarks: mirroredWorldLandmarks,
    club: frame.club ? mirrorClubState(frame.club) : undefined
  };
}
