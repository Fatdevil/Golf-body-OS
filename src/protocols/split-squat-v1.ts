/**
 * Split Squat Capacity V1 Protocol Definition
 *
 * Defines the test protocol for measuring functional lower body capacity,
 * repetition quality, and fatigue breakdown on Left and Right sides.
 *
 * @module split-squat-v1
 */

import { LandmarkId } from '../core/types/landmark';
import { TestProtocol, CameraView, BodySide } from '../core/types/protocol';

export const VERSION = 'SPLIT_SQUAT_PROTOCOL_V1';

export function createSplitSquatProtocol(side: 'LEFT' | 'RIGHT'): TestProtocol {
  const isLeft = side === 'LEFT';

  const requiredNearSide = isLeft
    ? [
        LandmarkId.LEFT_EAR,
        LandmarkId.LEFT_SHOULDER,
        LandmarkId.LEFT_HIP,
        LandmarkId.LEFT_KNEE,
        LandmarkId.LEFT_ANKLE,
        LandmarkId.LEFT_HEEL,
      ]
    : [
        LandmarkId.RIGHT_EAR,
        LandmarkId.RIGHT_SHOULDER,
        LandmarkId.RIGHT_HIP,
        LandmarkId.RIGHT_KNEE,
        LandmarkId.RIGHT_ANKLE,
        LandmarkId.RIGHT_HEEL,
      ];

  const optionalFarSide = isLeft
    ? [
        LandmarkId.RIGHT_EAR,
        LandmarkId.RIGHT_SHOULDER,
        LandmarkId.RIGHT_HIP,
        LandmarkId.RIGHT_KNEE,
        LandmarkId.RIGHT_ANKLE,
        LandmarkId.RIGHT_HEEL,
      ]
    : [
        LandmarkId.LEFT_EAR,
        LandmarkId.LEFT_SHOULDER,
        LandmarkId.LEFT_HIP,
        LandmarkId.LEFT_KNEE,
        LandmarkId.LEFT_ANKLE,
        LandmarkId.LEFT_HEEL,
      ];

  return {
    id: `SPLIT_SQUAT_CAPACITY_${side}`,
    version: '1.0.0',
    requiredView: 'SIDE' as CameraView,
    standardizedSide: (side === 'LEFT' ? 'LEFT' : 'RIGHT') as BodySide,
    requiredNearSideLandmarks: requiredNearSide,
    optionalFarSideLandmarks: optionalFarSide,
    minVisibility: 0.6,
    minFrames: 120,
    setupInstructions: [
      {
        text: `Stand sideways to the camera with your ${side} side closest.`,
      },
      {
        text: `Step your ${isLeft ? 'right' : 'left'} leg back into a split stance. The ${side} leg is the lead leg.`,
      },
      {
        text: 'Ensure your full body is visible from head to feet in the frame.',
      },
      {
        text: 'Place your hands on your hips or across your chest.',
      },
    ],
    movementInstructions: [
      {
        text: 'Lower your back knee smoothly toward the floor until your lead knee is at roughly 90 degrees.',
      },
      {
        text: 'Keep your chest tall and avoid leaning heavily forward.',
      },
      {
        text: 'Drive through your lead foot to return to the top of the split stance.',
      },
      {
        text: 'Perform as many controlled, continuous repetitions as possible until fatigue.',
      },
    ],
    repetitionCount: 15, // Cap or target for standard protocol
    qualityRules: [
      {
        id: 'LEAD_LEG_VISIBLE',
        description: 'All required near-side lead leg landmarks must be clearly visible.',
        check: (frame) => {
          return requiredNearSide.every((id) => {
            const lm = frame.landmarks.find((l) => l.id === id);
            return lm !== undefined && (lm.visibility ?? 0) >= 0.6;
          });
        },
      },
    ],
    phaseDetector: 'SPLIT_SQUAT_PHASE_ENGINE_V1',
    metricIds: [
      'SPLIT_SQUAT_TOTAL_REPS',
      'SPLIT_SQUAT_VALID_REPS',
      'SPLIT_SQUAT_AVG_KNEE_DEPTH',
      'SPLIT_SQUAT_TRUNK_INCLINATION',
      'SPLIT_SQUAT_TEMPO_CONSISTENCY',
      'SPLIT_SQUAT_FATIGUE_POINT',
    ],
  };
}

export const SPLIT_SQUAT_LEFT_V1: TestProtocol = createSplitSquatProtocol('LEFT');
export const SPLIT_SQUAT_RIGHT_V1: TestProtocol = createSplitSquatProtocol('RIGHT');
