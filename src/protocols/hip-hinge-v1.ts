/**
 * Hip Hinge V1 Protocol Definition
 *
 * Defines the complete test protocol for the hip hinge assessment.
 * Uses LEFT side standardization per spec correction #6.
 *
 * @module hip-hinge-v1
 */

import { LandmarkId } from '../core/types/landmark';
import { TestProtocol, CameraView, BodySide } from '../core/types/protocol';

export const VERSION = 'HIP_HINGE_PROTOCOL_V1';

export const HIP_HINGE_V1: TestProtocol = {
  id: 'HIP_HINGE_V1',
  version: '1.0.0',
  requiredView: 'SIDE' as CameraView,
  standardizedSide: 'LEFT' as BodySide,
  requiredNearSideLandmarks: [
    LandmarkId.LEFT_EAR,
    LandmarkId.LEFT_SHOULDER,
    LandmarkId.LEFT_HIP,
    LandmarkId.LEFT_KNEE,
    LandmarkId.LEFT_ANKLE,
    LandmarkId.LEFT_HEEL,
  ],
  optionalFarSideLandmarks: [
    LandmarkId.RIGHT_EAR,
    LandmarkId.RIGHT_SHOULDER,
    LandmarkId.RIGHT_HIP,
    LandmarkId.RIGHT_KNEE,
    LandmarkId.RIGHT_ANKLE,
    LandmarkId.RIGHT_HEEL,
  ],
  minVisibility: 0.6,
  minFrames: 90,
  setupInstructions: [
    {
      text: 'Stand sideways to the camera with your LEFT side closest.',
    },
    {
      text: 'Position yourself so your full body is visible from head to feet.',
    },
    {
      text: 'Stand approximately 2-3 meters from the camera.',
    },
    {
      text: 'Place your hands across your chest or behind your head.',
    },
  ],
  movementInstructions: [
    {
      text: 'Stand tall with feet hip-width apart.',
    },
    {
      text: 'Push your hips backward while keeping your back straight.',
    },
    {
      text: 'Lower your torso until you feel a stretch in your hamstrings.',
    },
    {
      text: 'Return to standing by driving your hips forward.',
    },
    {
      text: 'Repeat for the prescribed number of repetitions.',
    },
  ],
  repetitionCount: 3,
  qualityRules: [
    {
      id: 'NEAR_SIDE_VISIBLE',
      description: 'All required near-side landmarks must be visible above threshold.',
      check: (frame) => {
        const requiredIds = [
          LandmarkId.LEFT_EAR,
          LandmarkId.LEFT_SHOULDER,
          LandmarkId.LEFT_HIP,
          LandmarkId.LEFT_KNEE,
          LandmarkId.LEFT_ANKLE,
          LandmarkId.LEFT_HEEL,
        ];
        return requiredIds.every((id) => {
          const lm = frame.landmarks.find((l) => l.id === id);
          return lm !== undefined && (lm.visibility ?? 0) >= 0.6;
        });
      },
    },
  ],
  phaseDetector: 'HIP_HINGE_PHASE_ENGINE_V1',
  metricIds: [
    'HIP_HINGE_ANGLE_2D',
    'TRUNK_INCLINATION',
    'KNEE_ANGLE_AT_ENDPOINT',
    'SHANK_INCLINATION',
    'POSTERIOR_HIP_SHIFT',
  ],
};
