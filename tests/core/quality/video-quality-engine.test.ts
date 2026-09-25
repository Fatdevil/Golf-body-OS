/**
 * video-quality-engine.test.ts
 * Tests for the Video Quality Gate orchestrator.
 */

import { evaluateVideoQuality, VideoQualityEngine } from '../../../src/core/quality';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';
import { PoseFrame } from '../../../src/core/types/pose-frame';
import { LandmarkId } from '../../../src/core/types/landmark';

describe('VideoQualityEngine', () => {
  let referenceSwing: PoseFrame[];

  beforeAll(() => {
    referenceSwing = generate240FpsSwingSequence(480, 'OPTIMAL', 'FACE_ON');
  });

  test('should PASS on high-quality 240 fps reference swing', () => {
    const result = evaluateVideoQuality(referenceSwing, { width: 1080, height: 1920 });

    expect(result.overallStatus).toBe('PASS');
    expect(result.analysisRecommended).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.checks.bodyVisibility.status).toBe('PASS');
    expect(result.checks.golferSize.status).toBe('PASS');
    expect(result.checks.poseCoverage.status).toBe('PASS');
    expect(result.checks.videoSuitability.status).toBe('PASS');
    expect(result.warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
    expect(result.summaryMessageSv).toContain('optimal');
    expect(result.summaryMessageEn).toContain('excellent');
  });

  test('should FAIL when frame array is empty', () => {
    const result = evaluateVideoQuality([]);

    expect(result.overallStatus).toBe('FAIL');
    expect(result.analysisRecommended).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.warnings.some((w) => w.code === 'NO_FRAMES')).toBe(true);
    expect(result.summaryMessageSv).toBeDefined();
  });

  test('should FAIL when fewer than 15 analyzable frames are available', () => {
    const shortSequence = referenceSwing.slice(0, 10);
    const result = evaluateVideoQuality(shortSequence);

    expect(result.overallStatus).toBe('FAIL');
    expect(result.analysisRecommended).toBe(false);
    expect(result.warnings.some((w) => w.code === 'TOO_FEW_RELIABLE_FRAMES')).toBe(true);
  });

  test('should FAIL when crucial body regions (hips and ankles) are missing', () => {
    // Strip hips and ankles
    const missingLowerBody = referenceSwing.map((f) => ({
      ...f,
      landmarks: f.landmarks.filter(
        (l) =>
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

    const result = evaluateVideoQuality(missingLowerBody);

    expect(result.overallStatus).toBe('FAIL');
    expect(result.analysisRecommended).toBe(false);
    expect(result.checks.bodyVisibility.status).toBe('FAIL');
    expect(result.warnings.some((w) => w.code === 'LOW_REGION_VISIBILITY')).toBe(true);

    const ankleWarning = result.warnings.find(
      (w) => w.code === 'LOW_REGION_VISIBILITY' && w.details?.region === 'ankles'
    );
    expect(ankleWarning).toBeDefined();
    expect(ankleWarning?.messageSv).toContain('fötter');
  });

  test('should warn GOLFER_TOO_SMALL when golfer occupies very small part of frame', () => {
    // Compress all landmarks towards center (small bounding box < 10% diagonal)
    const tinyGolferFrames = referenceSwing.map((f) => ({
      ...f,
      landmarks: f.landmarks.map((l) => ({
        ...l,
        x: 0.5 + (l.x - 0.5) * 0.05,
        y: 0.5 + (l.y - 0.5) * 0.05,
      })),
    }));

    const result = evaluateVideoQuality(tinyGolferFrames);

    expect(result.checks.golferSize.status).toBe('WARNING');
    expect(result.warnings.some((w) => w.code === 'GOLFER_TOO_SMALL')).toBe(true);
    const sizeWarn = result.warnings.find((w) => w.code === 'GOLFER_TOO_SMALL');
    expect(sizeWarn?.messageSv).toContain('Golfaren är för liten i bild');
  });

  test('should warn LOW_RELIABLE_RATIO when tracking confidence is low across frames', () => {
    // Degrade visibility on 70% of frames
    const degradedFrames = referenceSwing.map((f, idx) => ({
      ...f,
      landmarks: f.landmarks.map((l) => ({
        ...l,
        visibility: idx % 3 === 0 ? 0.9 : 0.2, // 2 out of 3 frames have low visibility
      })),
    }));

    const result = evaluateVideoQuality(degradedFrames);

    expect(result.checks.poseCoverage.reliableRatio).toBeLessThan(0.60);
    expect(result.warnings.some((w) => w.code === 'LOW_RELIABLE_RATIO')).toBe(true);
  });

  test('should FAIL when effective video duration is under 1.0s', () => {
    // 240fps played at real-time with only 30 frames = 0.125s
    const quickClip = referenceSwing.slice(0, 30);
    const result = evaluateVideoQuality(quickClip, { durationSec: 0.5 });

    expect(result.checks.videoSuitability.status).toBe('FAIL');
    expect(result.warnings.some((w) => w.code === 'VIDEO_TOO_SHORT')).toBe(true);
  });

  test('should handle slow-motion video metadata correctly', () => {
    // Video with 8.0s duration but recorded in 4x slow-mo -> effective 2.0s real-time
    const result = evaluateVideoQuality(referenceSwing, {
      durationSec: 8.0,
      nominalFps: 120,
      width: 1080,
      height: 1920,
      isSlowMotion: true,
      slowMotionFactor: 4,
    });

    expect(result.checks.videoSuitability.effectiveDurationSec).toBe(2.0);
    expect(result.warnings.some((w) => w.code === 'SLOW_MOTION_DETECTED')).toBe(true);
    expect(result.checks.videoSuitability.status).toBe('PASS');
  });

  test('VideoQualityEngine class instance should respect customized thresholds', () => {
    // Customize minBodyRatio to very high 0.85 so standard swing warns
    const engine = new VideoQualityEngine({
      thresholds: {
        minBodyRatio: 0.85,
      },
    });

    const result = engine.evaluate(referenceSwing);

    expect(result.checks.golferSize.status).toBe('WARNING');
    expect(result.warnings.some((w) => w.code === 'GOLFER_TOO_SMALL')).toBe(true);
  });
});
