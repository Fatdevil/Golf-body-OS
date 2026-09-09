import { LandmarkId } from '../../../src/core/types/landmark';
import { PoseFrame } from '../../../src/core/types/pose-frame';
import {
  getCranialCenter,
  computeHeadRotation,
  extractPhaseKinematics
} from '../../../src/core/metrics/golf-swing-metrics';

describe('3D Head & Knee Biomechanical Metrics', () => {
  const createMockFrame = (landmarks: Array<{ id: LandmarkId; x: number; y: number; z?: number }>): PoseFrame => ({
    frameId: 1,
    timestampMs: 100,
    width: 640,
    height: 480,
    landmarks: landmarks.map(lm => ({ ...lm, z: lm.z ?? 0, visibility: 0.99 })),
    model: 'MEDIAPIPE_POSE',
    modelVersion: '0.10.14'
  });

  describe('getCranialCenter', () => {
    it('should compute the true cranial center from ear midpoint', () => {
      const frame = createMockFrame([
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.16, z: 0 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.16, z: 0 },
        { id: LandmarkId.NOSE, x: 0.50, y: 0.16, z: 0.03 }
      ]);

      const center = getCranialCenter(frame);
      expect(center).toBeDefined();
      expect(center?.x).toBeCloseTo(0.50, 4);
      expect(center?.y).toBeCloseTo(0.16, 4);
    });

    it('should keep cranial center invariant during pure head rotation', () => {
      // Address: looking straight ahead
      const straightFrame = createMockFrame([
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.16, z: 0 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.16, z: 0 },
        { id: LandmarkId.NOSE, x: 0.50, y: 0.16, z: 0.03 }
      ]);

      // Rotated head 20° to the right (nose moves right, right ear moves back, left ear moves forward)
      const rotatedFrame = createMockFrame([
        { id: LandmarkId.LEFT_EAR, x: 0.472, y: 0.16, z: -0.01 },
        { id: LandmarkId.RIGHT_EAR, x: 0.528, y: 0.16, z: 0.01 },
        { id: LandmarkId.NOSE, x: 0.515, y: 0.16, z: 0.02 } // Nose shifted right by 1.5 cm!
      ]);

      const straightCenter = getCranialCenter(straightFrame);
      const rotatedCenter = getCranialCenter(rotatedFrame);

      // Cranial center should remain virtually identical at x = 0.50
      expect(straightCenter?.x).toBeCloseTo(0.50, 3);
      expect(rotatedCenter?.x).toBeCloseTo(0.50, 3);
    });

    it('should fall back to NOSE if ears are absent', () => {
      const frame = createMockFrame([
        { id: LandmarkId.NOSE, x: 0.51, y: 0.17 }
      ]);

      const center = getCranialCenter(frame);
      expect(center).toBeDefined();
      expect(center?.x).toBeCloseTo(0.51, 4);
      expect(center?.y).toBeCloseTo(0.17, 4);
    });
  });

  describe('computeHeadRotation', () => {
    it('should calculate ~0° yaw and tilt when looking straight ahead', () => {
      const frame = createMockFrame([
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.16, z: 0 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.16, z: 0 },
        { id: LandmarkId.NOSE, x: 0.50, y: 0.16, z: 0.03 }
      ]);

      const rot = computeHeadRotation(frame);
      expect(rot.yawDeg).toBe(0);
      expect(rot.tiltDeg).toBe(0);
    });

    it('should calculate positive yaw when head turns right', () => {
      const frame = createMockFrame([
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.16, z: 0 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.16, z: 0 },
        { id: LandmarkId.NOSE, x: 0.515, y: 0.16, z: 0.02 } // Nose offset right
      ]);

      const rot = computeHeadRotation(frame);
      expect(rot.yawDeg).toBeGreaterThan(15);
      expect(rot.yawDeg).toBeLessThan(40);
    });

    it('should calculate lateral head tilt (roll)', () => {
      // Right ear lower than left ear = tilted towards right shoulder
      const frame = createMockFrame([
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.15, z: 0 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.17, z: 0 },
        { id: LandmarkId.NOSE, x: 0.50, y: 0.16, z: 0.03 }
      ]);

      const rot = computeHeadRotation(frame);
      expect(rot.tiltDeg).toBeGreaterThan(5);
    });
  });

  describe('extractPhaseKinematics integration', () => {
    it('should not misdiagnose head rotation as lateral head sway', () => {
      const baseBody = [
        { id: LandmarkId.LEFT_SHOULDER, x: 0.42, y: 0.28 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.58, y: 0.28 },
        { id: LandmarkId.LEFT_HIP, x: 0.44, y: 0.50 },
        { id: LandmarkId.RIGHT_HIP, x: 0.56, y: 0.50 },
        { id: LandmarkId.LEFT_KNEE, x: 0.44, y: 0.70 },
        { id: LandmarkId.RIGHT_KNEE, x: 0.56, y: 0.70 },
        { id: LandmarkId.LEFT_ANKLE, x: 0.42, y: 0.88 },
        { id: LandmarkId.RIGHT_ANKLE, x: 0.58, y: 0.88 }
      ];

      // Address: Head looking straight
      const addressFrame = createMockFrame([
        ...baseBody,
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.16 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.16 },
        { id: LandmarkId.NOSE, x: 0.50, y: 0.16 }
      ]);

      // Top of Backswing: Player turned their head 15° right, but body stays centered
      const topFrame = createMockFrame([
        ...baseBody,
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.16 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.16 },
        { id: LandmarkId.NOSE, x: 0.515, y: 0.16 } // Nose shifted right by 1.5 cm!
      ]);

      const kinematics = extractPhaseKinematics(topFrame, 'P4_TOP', addressFrame, 'FACE_ON');

      // Lateral head sway should be 0 because cranial center did not translate!
      expect(kinematics.lateralHeadSway).toBe(0);
      // Head rotation should capture the 15-30° turn
      expect(kinematics.headRotationDeg).toBeGreaterThan(15);
    });

    it('should compute Tiger vertical dip and knee flexion correctly', () => {
      const addressFrame = createMockFrame([
        { id: LandmarkId.LEFT_SHOULDER, x: 0.42, y: 0.28 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.58, y: 0.28 },
        { id: LandmarkId.LEFT_HIP, x: 0.44, y: 0.50 },
        { id: LandmarkId.RIGHT_HIP, x: 0.56, y: 0.50 },
        { id: LandmarkId.LEFT_KNEE, x: 0.44, y: 0.70 },
        { id: LandmarkId.RIGHT_KNEE, x: 0.56, y: 0.70 },
        { id: LandmarkId.LEFT_ANKLE, x: 0.42, y: 0.88 },
        { id: LandmarkId.RIGHT_ANKLE, x: 0.58, y: 0.88 },
        { id: LandmarkId.LEFT_EAR, x: 0.47, y: 0.16 },
        { id: LandmarkId.RIGHT_EAR, x: 0.53, y: 0.16 },
        { id: LandmarkId.NOSE, x: 0.50, y: 0.16 }
      ]);

      // Delivery frame: Head dips down (Y = 0.18 vs 0.16), lead knee straightening
      const deliveryFrame = createMockFrame([
        { id: LandmarkId.LEFT_SHOULDER, x: 0.40, y: 0.29 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.56, y: 0.29 },
        { id: LandmarkId.LEFT_HIP, x: 0.42, y: 0.51 },
        { id: LandmarkId.RIGHT_HIP, x: 0.54, y: 0.51 },
        { id: LandmarkId.LEFT_KNEE, x: 0.43, y: 0.70 },
        { id: LandmarkId.RIGHT_KNEE, x: 0.52, y: 0.70 },
        { id: LandmarkId.LEFT_ANKLE, x: 0.42, y: 0.88 },
        { id: LandmarkId.RIGHT_ANKLE, x: 0.58, y: 0.88 },
        { id: LandmarkId.LEFT_EAR, x: 0.45, y: 0.18 },
        { id: LandmarkId.RIGHT_EAR, x: 0.51, y: 0.18 },
        { id: LandmarkId.NOSE, x: 0.48, y: 0.18 }
      ]);

      const kinematics = extractPhaseKinematics(deliveryFrame, 'P6_DELIVERY', addressFrame, 'FACE_ON');

      // Head vertical dip should be positive (downward movement in image space)
      expect(kinematics.headVerticalDip).toBeGreaterThan(0);
      expect(kinematics.leadKneeFlexionDeg).toBeDefined();
      expect(kinematics.trailKneeFlexionDeg).toBeDefined();
    });
  });
});
