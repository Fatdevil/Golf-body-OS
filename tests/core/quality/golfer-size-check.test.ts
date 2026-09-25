/**
 * golfer-size-check.test.ts
 * Dedicated unit tests for golfer bounding box and frame ratio check.
 */

import { checkGolferSize } from '../../../src/core/quality/checks/golfer-size-check';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';

describe('checkGolferSize', () => {
  const referenceSwing = generate240FpsSwingSequence(240, 'OPTIMAL', 'FACE_ON');

  test('should return PASS on well-framed golfer', () => {
    const result = checkGolferSize(referenceSwing);

    expect(result.status).toBe('PASS');
    expect(result.bodyRatio).toBeGreaterThan(0.20);
    expect(result.bodyRatio).toBeLessThan(0.85);
    expect(result.confidence).toBe(1.0);
    expect(result.warnings).toHaveLength(0);
  });

  test('should return FAIL on empty frames array', () => {
    const result = checkGolferSize([]);

    expect(result.status).toBe('FAIL');
    expect(result.bodyRatio).toBe(0);
    expect(result.warnings.some((w) => w.code === 'NO_FRAMES')).toBe(true);
  });

  test('should return FAIL when frames contain no landmarks', () => {
    const emptyLandmarkFrames = referenceSwing.map((f) => ({
      ...f,
      landmarks: [],
    }));

    const result = checkGolferSize(emptyLandmarkFrames);

    expect(result.status).toBe('FAIL');
    expect(result.warnings.some((w) => w.code === 'NO_LANDMARKS')).toBe(true);
  });

  test('should warn GOLFER_TOO_SMALL when ratio is below threshold', () => {
    const shrunkFrames = referenceSwing.map((f) => ({
      ...f,
      landmarks: f.landmarks.map((l) => ({
        ...l,
        x: 0.5 + (l.x - 0.5) * 0.1,
        y: 0.5 + (l.y - 0.5) * 0.1,
      })),
    }));

    const result = checkGolferSize(shrunkFrames);

    expect(result.status).toBe('WARNING');
    expect(result.bodyRatio).toBeLessThan(0.15);
    expect(result.confidence).toBeLessThan(1.0);
    expect(result.warnings.some((w) => w.code === 'GOLFER_TOO_SMALL')).toBe(true);
  });

  test('should warn GOLFER_TOO_LARGE when points hit border edges', () => {
    const stretchedFrames = referenceSwing.map((f) => ({
      ...f,
      landmarks: f.landmarks.map((l) => ({
        ...l,
        x: l.x < 0.5 ? 0.005 : 0.995,
        y: l.y < 0.5 ? 0.005 : 0.995,
      })),
    }));

    const result = checkGolferSize(stretchedFrames);

    expect(result.status).toBe('WARNING');
    expect(result.warnings.some((w) => w.code === 'GOLFER_TOO_LARGE')).toBe(true);
  });
});
