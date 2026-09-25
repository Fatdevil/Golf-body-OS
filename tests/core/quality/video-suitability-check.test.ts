/**
 * video-suitability-check.test.ts
 * Dedicated unit tests for video duration, orientation, and resolution check.
 */

import { checkVideoSuitability } from '../../../src/core/quality/checks/video-suitability-check';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';

describe('checkVideoSuitability', () => {
  const referenceSwing = generate240FpsSwingSequence(240, 'OPTIMAL', 'FACE_ON');

  test('should return PASS on standard portrait video with adequate duration', () => {
    const result = checkVideoSuitability(referenceSwing, {
      width: 1080,
      height: 1920,
      durationSec: 2.5,
    });

    expect(result.status).toBe('PASS');
    expect(result.durationSec).toBe(2.5);
    expect(result.effectiveDurationSec).toBe(2.5);
    expect(result.orientation).toBe('portrait');
    expect(result.confidence).toBe(1.0);
    expect(result.warnings).toHaveLength(0);
  });

  test('should fail when video duration is below 1.0s', () => {
    const result = checkVideoSuitability(referenceSwing, {
      width: 1080,
      height: 1920,
      durationSec: 0.6,
    });

    expect(result.status).toBe('FAIL');
    expect(result.warnings.some((w) => w.code === 'VIDEO_TOO_SHORT')).toBe(true);
  });

  test('should fail when video duration exceeds absolute maximum (60s)', () => {
    const result = checkVideoSuitability(referenceSwing, {
      width: 1080,
      height: 1920,
      durationSec: 75.0,
    });

    expect(result.status).toBe('FAIL');
    expect(result.warnings.some((w) => w.code === 'VIDEO_TOO_LONG_HARD')).toBe(true);
  });

  test('should warn when video duration exceeds recommended 15s', () => {
    const result = checkVideoSuitability(referenceSwing, {
      width: 1080,
      height: 1920,
      durationSec: 22.0,
    });

    expect(result.status).toBe('WARNING');
    expect(result.warnings.some((w) => w.code === 'VIDEO_TOO_LONG')).toBe(true);
  });

  test('should warn on landscape orientation', () => {
    const result = checkVideoSuitability(referenceSwing, {
      width: 1920,
      height: 1080,
      durationSec: 3.0,
    });

    expect(result.status).toBe('WARNING');
    expect(result.orientation).toBe('landscape');
    expect(result.warnings.some((w) => w.code === 'LANDSCAPE_ORIENTATION')).toBe(true);
  });

  test('should warn on low resolution (< 480px)', () => {
    const result = checkVideoSuitability(referenceSwing, {
      width: 320,
      height: 400,
      durationSec: 2.0,
    });

    expect(result.status).toBe('WARNING');
    expect(result.warnings.some((w) => w.code === 'LOW_RESOLUTION')).toBe(true);
  });

  test('should recognize slow-motion factor and scale effective duration', () => {
    const result = checkVideoSuitability(referenceSwing, {
      width: 1080,
      height: 1920,
      durationSec: 16.0,
      isSlowMotion: true,
      slowMotionFactor: 8,
    });

    // 16s container / 8x factor = 2s effective duration
    expect(result.effectiveDurationSec).toBe(2.0);
    expect(result.warnings.some((w) => w.code === 'SLOW_MOTION_DETECTED')).toBe(true);
    expect(result.status).toBe('PASS'); // Effective 2s is within 1.0-15.0s range!
  });
});
