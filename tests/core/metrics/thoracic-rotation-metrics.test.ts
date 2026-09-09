import {
  calculateTransverseRotation,
  calculateFrontalTilt,
  extractRotationSample,
  summarizeThoracicRotation,
  RotationSample,
} from '../../../src/core/metrics/thoracic-rotation-metrics';
import { LandmarkId } from '../../../src/core/types/landmark';

describe('ThoracicRotationMetrics', () => {
  describe('calculateTransverseRotation', () => {
    it('returns 0 when landmarks have equal z-depth (neutral facing camera)', () => {
      const left = { x: -0.2, z: 0 };
      const right = { x: 0.2, z: 0 };
      const angle = calculateTransverseRotation(left, right);
      expect(angle).toBeCloseTo(0, 1);
    });

    it('returns positive angle when turning left (left shoulder back, right shoulder forward)', () => {
      const left = { x: -0.15, z: 0.15 };
      const right = { x: 0.15, z: -0.15 };
      const angle = calculateTransverseRotation(left, right);
      expect(angle).toBeGreaterThan(0);
      expect(angle).toBeCloseTo(45, 0);
    });

    it('returns negative angle when turning right (left shoulder forward, right shoulder back)', () => {
      const left = { x: -0.15, z: -0.15 };
      const right = { x: 0.15, z: 0.15 };
      const angle = calculateTransverseRotation(left, right);
      expect(angle).toBeLessThan(0);
      expect(angle).toBeCloseTo(-45, 0);
    });
  });

  describe('calculateFrontalTilt', () => {
    it('returns 0 for level shoulders', () => {
      const left = { x: -0.2, y: 0.3 };
      const right = { x: 0.2, y: 0.3 };
      const tilt = calculateFrontalTilt(left, right);
      expect(tilt).toBeCloseTo(0, 1);
    });

    it('calculates shoulder dip angle correctly', () => {
      const left = { x: -0.2, y: 0.25 };
      const right = { x: 0.2, y: 0.35 };
      const tilt = calculateFrontalTilt(left, right);
      expect(Math.abs(tilt)).toBeGreaterThan(10);
    });
  });

  describe('extractRotationSample', () => {
    it('returns null if any required landmark is missing', () => {
      const landmarks = [
        { id: LandmarkId.LEFT_SHOULDER, x: -0.2, y: 0.3, z: 0 },
        // missing right shoulder, left hip, right hip
      ];
      const sample = extractRotationSample(landmarks as any, 1, 100);
      expect(sample).toBeNull();
    });

    it('computes isolated thoracic angle as shoulder - pelvic rotation', () => {
      const landmarks = [
        { id: LandmarkId.LEFT_SHOULDER, x: -0.15, y: 0.3, z: 0.15, visibility: 0.9 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.15, y: 0.3, z: -0.15, visibility: 0.9 },
        { id: LandmarkId.LEFT_HIP, x: -0.1, y: -0.1, z: 0.05, visibility: 0.9 },
        { id: LandmarkId.RIGHT_HIP, x: 0.1, y: -0.1, z: -0.05, visibility: 0.9 },
      ];
      const sample = extractRotationSample(landmarks as any, 1, 100);
      expect(sample).not.toBeNull();
      expect(sample!.shoulderRotation).toBeGreaterThan(sample!.pelvicRotation);
      expect(sample!.isolatedThoracic).toBeCloseTo(
        sample!.shoulderRotation - sample!.pelvicRotation,
        2
      );
    });
  });

  describe('summarizeThoracicRotation', () => {
    it('handles empty samples safely', () => {
      const summary = summarizeThoracicRotation([]);
      expect(summary.maxRotationLeft).toBe(0);
      expect(summary.maxRotationRight).toBe(0);
      expect(summary.rotationAsymmetry).toBe(0);
    });

    it('computes max left, right, asymmetry, and detects compensations', () => {
      const samples: RotationSample[] = [
        // Neutral
        {
          timestampMs: 1000,
          frameId: 1,
          shoulderRotation: 0,
          pelvicRotation: 0,
          isolatedThoracic: 0,
          lateralTilt: 0,
        },
        // Max turn Left (50° thoracic, 10° pelvic, 4° tilt)
        {
          timestampMs: 3000,
          frameId: 60,
          shoulderRotation: 60,
          pelvicRotation: 10,
          isolatedThoracic: 50,
          lateralTilt: 4,
        },
        // Return to center
        {
          timestampMs: 5000,
          frameId: 120,
          shoulderRotation: 0,
          pelvicRotation: 0,
          isolatedThoracic: 0,
          lateralTilt: 1,
        },
        // Max turn Right (-30° thoracic, -30° pelvic -> pelvic compensation! -15° tilt -> tilt compensation!)
        {
          timestampMs: 7000,
          frameId: 180,
          shoulderRotation: -60,
          pelvicRotation: -30,
          isolatedThoracic: -30,
          lateralTilt: -15,
        },
      ];

      const result = summarizeThoracicRotation(samples);
      expect(result.maxRotationLeft).toBe(50);
      expect(result.maxRotationRight).toBe(30);
      expect(result.rotationAsymmetry).toBe(20); // 50 - 30 = 20 (severe asymmetry!)
      expect(result.compensations.severeAsymmetry).toBe(true);
      expect(result.compensations.excessivePelvicRotation).toBe(true);
      expect(result.compensations.excessiveLateralTilt).toBe(true);
      expect(result.endpointLeftFrameId).toBe(60);
      expect(result.endpointRightFrameId).toBe(180);
    });
  });
});
