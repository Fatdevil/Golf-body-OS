/**
 * pose-coverage-check.test.ts
 * Dedicated unit tests for pose tracking coverage and frame confidence check.
 */

import { checkPoseCoverage } from '../../../src/core/quality/checks/pose-coverage-check';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';

describe('checkPoseCoverage', () => {
  const referenceSwing = generate240FpsSwingSequence(100, 'OPTIMAL', 'FACE_ON');

  test('should return PASS on sequence with 100% reliable tracking', () => {
    const result = checkPoseCoverage(referenceSwing);

    expect(result.status).toBe('PASS');
    expect(result.totalFrames).toBe(100);
    expect(result.validFrames).toBe(100);
    expect(result.reliableFrames).toBe(100);
    expect(result.reliableRatio).toBe(1.0);
    expect(result.confidence).toBe(1.0);
    expect(result.warnings).toHaveLength(0);
  });

  test('should return FAIL on empty frame sequence', () => {
    const result = checkPoseCoverage([]);

    expect(result.status).toBe('FAIL');
    expect(result.totalFrames).toBe(0);
    expect(result.warnings.some((w) => w.code === 'NO_FRAMES')).toBe(true);
  });

  test('should return FAIL when reliable frames are fewer than 15', () => {
    const shortSequence = referenceSwing.slice(0, 12);
    const result = checkPoseCoverage(shortSequence);

    expect(result.status).toBe('FAIL');
    expect(result.reliableFrames).toBe(12);
    expect(result.warnings.some((w) => w.code === 'TOO_FEW_RELIABLE_FRAMES')).toBe(true);
  });

  test('should warn LOW_RELIABLE_RATIO when under 60% of frames are reliable', () => {
    // 50 frames with low confidence, 50 frames with high confidence -> 50% ratio
    const mixedFrames = referenceSwing.map((f, idx) => ({
      ...f,
      landmarks: f.landmarks.map((l) => ({
        ...l,
        visibility: idx < 50 ? 0.2 : 0.9,
      })),
    }));

    const result = checkPoseCoverage(mixedFrames);

    expect(result.status).toBe('WARNING');
    expect(result.reliableRatio).toBe(0.5);
    expect(result.warnings.some((w) => w.code === 'LOW_RELIABLE_RATIO')).toBe(true);
  });
});
