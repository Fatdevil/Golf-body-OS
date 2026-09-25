/**
 * body-visibility-check.test.ts
 * Dedicated unit tests for anatomical body region visibility check.
 */

import { checkBodyVisibility } from '../../../src/core/quality/checks/body-visibility-check';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';
import { LandmarkId } from '../../../src/core/types/landmark';

describe('checkBodyVisibility', () => {
  const referenceSwing = generate240FpsSwingSequence(240, 'OPTIMAL', 'FACE_ON');

  test('should return PASS and evaluate all 7 regions on full body swing', () => {
    const result = checkBodyVisibility(referenceSwing);

    expect(result.status).toBe('PASS');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.regions).toHaveLength(7);
    expect(result.regions.every((r) => r.status === 'PASS')).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  test('should return FAIL when no frames are provided', () => {
    const result = checkBodyVisibility([]);

    expect(result.status).toBe('FAIL');
    expect(result.confidence).toBe(0);
    expect(result.warnings.some((w) => w.code === 'NO_FRAMES')).toBe(true);
  });

  test('should warn when arms (elbows or wrists) are hidden', () => {
    const missingWrists = referenceSwing.map((f) => ({
      ...f,
      landmarks: f.landmarks.filter(
        (l) => l.id !== LandmarkId.LEFT_WRIST && l.id !== LandmarkId.RIGHT_WRIST
      ),
    }));

    const result = checkBodyVisibility(missingWrists);

    expect(result.status).toBe('WARNING');
    const wristRegion = result.regions.find((r) => r.region === 'wrists');
    expect(wristRegion?.status).toBe('FAIL');
    expect(wristRegion?.availability).toBe(0);
    expect(result.warnings.some((w) => w.code === 'LOW_REGION_VISIBILITY')).toBe(true);
  });

  test('should fail when multiple essential regions are missing', () => {
    // Missing all landmarks for head, hips, and feet
    const severeCutoff = referenceSwing.map((f) => ({
      ...f,
      landmarks: f.landmarks.filter(
        (l) =>
          l.id !== LandmarkId.NOSE &&
          l.id !== LandmarkId.LEFT_EYE &&
          l.id !== LandmarkId.RIGHT_EYE &&
          l.id !== LandmarkId.LEFT_EAR &&
          l.id !== LandmarkId.RIGHT_EAR &&
          l.id !== LandmarkId.LEFT_HIP &&
          l.id !== LandmarkId.RIGHT_HIP &&
          l.id !== LandmarkId.LEFT_ANKLE &&
          l.id !== LandmarkId.RIGHT_ANKLE &&
          l.id !== LandmarkId.LEFT_HEEL &&
          l.id !== LandmarkId.RIGHT_HEEL &&
          l.id !== LandmarkId.LEFT_FOOT_INDEX &&
          l.id !== LandmarkId.RIGHT_FOOT_INDEX
      ),
    }));

    const result = checkBodyVisibility(severeCutoff);

    expect(result.status).toBe('FAIL');
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });
});
