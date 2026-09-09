/**
 * Thoracic Rotation V1 Protocol Definition
 *
 * Defines the complete test protocol for the Thoracic (Trunk) Rotation assessment.
 * Uses FRONT camera perspective with bilateral landmark tracking.
 *
 * @module thoracic-rotation-v1
 */

import { LandmarkId } from '../core/types/landmark';
import { TestProtocol, CameraView, BodySide } from '../core/types/protocol';

export const VERSION = 'THORACIC_ROTATION_PROTOCOL_V1';

export const THORACIC_ROTATION_V1: TestProtocol = {
  id: 'THORACIC_ROTATION_V1',
  version: '1.0.0',
  requiredView: 'FRONT' as CameraView,
  standardizedSide: 'BILATERAL' as BodySide,
  requiredNearSideLandmarks: [
    LandmarkId.LEFT_SHOULDER,
    LandmarkId.RIGHT_SHOULDER,
    LandmarkId.LEFT_HIP,
    LandmarkId.RIGHT_HIP,
    LandmarkId.NOSE,
  ],
  optionalFarSideLandmarks: [
    LandmarkId.LEFT_ELBOW,
    LandmarkId.RIGHT_ELBOW,
    LandmarkId.LEFT_WRIST,
    LandmarkId.RIGHT_WRIST,
    LandmarkId.LEFT_KNEE,
    LandmarkId.RIGHT_KNEE,
    LandmarkId.LEFT_ANKLE,
    LandmarkId.RIGHT_ANKLE,
  ],
  minVisibility: 0.55,
  minFrames: 60,
  setupInstructions: [
    {
      text: 'Stand facing the camera squarely with feet shoulder-width apart.',
    },
    {
      text: 'Cross your arms across your chest (hands touching opposite shoulders).',
    },
    {
      text: 'Stand approximately 2-3 meters from the camera so your upper body and hips are clearly visible.',
    },
  ],
  movementInstructions: [
    {
      text: 'Keep your hips and pelvis as still and forward-facing as possible.',
    },
    {
      text: 'Slowly rotate your shoulders and chest as far as comfortable to the LEFT.',
    },
    {
      text: 'Hold the end position briefly, then return smoothly to center.',
    },
    {
      text: 'Slowly rotate your shoulders and chest as far as comfortable to the RIGHT.',
    },
    {
      text: 'Hold the end position briefly, then return smoothly to center.',
    },
  ],
  repetitionCount: 1, // 1 complete bilateral cycle (Left + Right)
  qualityRules: [
    {
      id: 'FRONT_VIEW_VISIBLE',
      description: 'Both shoulders and hips must be visible from the front.',
      check: (frame) => {
        const requiredIds = [
          LandmarkId.LEFT_SHOULDER,
          LandmarkId.RIGHT_SHOULDER,
          LandmarkId.LEFT_HIP,
          LandmarkId.RIGHT_HIP,
        ];
        return requiredIds.every((id) => {
          const lm = frame.landmarks.find((l) => l.id === id);
          return lm !== undefined && (lm.visibility ?? 0) >= 0.55;
        });
      },
    },
  ],
  phaseDetector: 'ROTATION_PHASE_ENGINE_V1',
  metricIds: [
    'THORACIC_ROTATION_LEFT',
    'THORACIC_ROTATION_RIGHT',
    'ROTATION_ASYMMETRY',
    'PELVIC_ROTATION_LEFT',
    'PELVIC_ROTATION_RIGHT',
    'SHOULDER_TILT_LEFT',
    'SHOULDER_TILT_RIGHT',
  ],
};
