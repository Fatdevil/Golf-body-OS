/**
 * pose-smoother.test.ts
 * Tests for Velocity-Adaptive EMA PoseSmoother.
 */

import {
  PoseSmoother,
  smoothPoseSequence,
  DEFAULT_POSE_SMOOTHER_CONFIG,
  POSE_SMOOTHER_VERSION,
} from '../../../../src/core/motion/filters/pose-smoother';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { LandmarkId } from '../../../../src/core/types/landmark';
import { GolfSwingPhaseEngine } from '../../../../src/core/motion/phases/golf-swing-phase-engine';
import { generate240FpsSwingSequence } from '../../../../src/core/data/sample-240fps-swing';

function createMockFrame(
  frameId: number,
  timestampMs: number,
  x: number,
  y: number,
  z = 0.0
): PoseFrame {
  return {
    frameId,
    timestampMs,
    width: 1080,
    height: 1920,
    model: 'MEDIAPIPE_POSE',
    modelVersion: '0.10.14',
    landmarks: [
      { id: LandmarkId.NOSE, x, y, z, visibility: 0.95, presence: 0.98 },
      { id: LandmarkId.LEFT_WRIST, x: x - 0.05, y: y + 0.1, z, visibility: 0.9 },
    ],
    worldLandmarks: [
      { id: LandmarkId.NOSE, x, y, z, visibility: 0.95 },
    ],
  };
}

describe('PoseSmoother (Velocity-Adaptive EMA)', () => {
  test('has correct version identifier', () => {
    expect(POSE_SMOOTHER_VERSION).toBe('POSE_SMOOTHER_V1');
  });

  test('smoothPoseSequence returns copy on empty or single-frame input', () => {
    expect(smoothPoseSequence([])).toEqual([]);

    const single = [createMockFrame(0, 0, 0.5, 0.5)];
    const smoothed = smoothPoseSequence(single);
    expect(smoothed).toHaveLength(1);
    expect(smoothed[0]?.landmarks[0]?.x).toBe(0.5);
  });

  test('heavily smooths low-velocity jitter (at standstill / address)', () => {
    // Generate 20 frames around (0.50, 0.50) with artificial jitter (+/- 0.02)
    const rawFrames: PoseFrame[] = [];
    const jitterNoise = [0.02, -0.015, 0.018, -0.02, 0.012, -0.01, 0.015, -0.018, 0.02, -0.01];

    for (let i = 0; i < 20; i++) {
      const noise = jitterNoise[i % jitterNoise.length] ?? 0;
      rawFrames.push(createMockFrame(i, i * 33.3, 0.50 + noise, 0.50 + noise));
    }

    const smoothedFrames = smoothPoseSequence(rawFrames);

    // Calculate variance of raw vs smoothed positions (frames 5 to 19 to allow warm-up)
    const rawDeviations = rawFrames.slice(5).map((f) => Math.abs(f.landmarks[0]!.x - 0.50));
    const smoothDeviations = smoothedFrames.slice(5).map((f) => Math.abs(f.landmarks[0]!.x - 0.50));

    const avgRawDev = rawDeviations.reduce((a, b) => a + b, 0) / rawDeviations.length;
    const avgSmoothDev = smoothDeviations.reduce((a, b) => a + b, 0) / smoothDeviations.length;

    // Smoothed deviations should be significantly smaller (at least 60% reduction in jitter amplitude)
    expect(avgSmoothDev).toBeLessThan(avgRawDev * 0.40);
  });

  test('disengages smoothing (alpha -> 1.0) during high-velocity swing motion (impact)', () => {
    // Simulate high-speed downswing: hands move rapidly across frames
    // Frame 0: (0.20, 0.20)
    // Frame 1: (0.45, 0.45) -> displacement = ~0.35 in 33ms (very high speed, typical club delivery)
    const fastFrames = [
      createMockFrame(0, 0, 0.20, 0.20),
      createMockFrame(1, 33.3, 0.55, 0.55),
    ];

    const smoothed = smoothPoseSequence(fastFrames);

    // At high speed, alpha should approach 1.0, meaning the second frame's position is very close to raw 0.55
    const smoothX = smoothed[1]!.landmarks[0]!.x;
    expect(smoothX).toBeGreaterThan(0.53); // Less than 0.02 lag even on massive jump
    expect(Math.abs(smoothX - 0.55)).toBeLessThan(0.025);
  });

  test('maintains FPS invariance when normalizeByFps is true', () => {
    // 30 fps frame jump of 0.03 in 33.3 ms
    const frames30 = [
      createMockFrame(0, 0, 0.50, 0.50),
      createMockFrame(1, 33.3, 0.53, 0.50),
    ];

    // 120 fps frame jump of 0.0075 in 8.33 ms (same physical velocity!)
    const frames120 = [
      createMockFrame(0, 0, 0.50, 0.50),
      createMockFrame(1, 8.33, 0.5075, 0.50),
    ];

    const smooth30 = smoothPoseSequence(frames30);
    const smooth120 = smoothPoseSequence(frames120);

    // Alpha calculated for both should be nearly identical because velocity is normalized
    // In frame 1 of 30fps: raw displacement was 0.03
    // In frame 1 of 120fps: raw displacement was 0.0075
    // Delta between raw and smooth ratio should match
    const ratio30 = (smooth30[1]!.landmarks[0]!.x - 0.50) / 0.03;
    const ratio120 = (smooth120[1]!.landmarks[0]!.x - 0.50) / 0.0075;

    expect(Math.abs(ratio30 - ratio120)).toBeLessThan(0.05);
  });

  test('preserves all metadata and worldLandmarks while remaining immutable', () => {
    const input = [
      createMockFrame(0, 100, 0.4, 0.4),
      createMockFrame(1, 133, 0.42, 0.42),
    ];

    const originalX = input[1]!.landmarks[0]!.x;
    const smoothed = smoothPoseSequence(input);

    // Immutability: input must not be modified
    expect(input[1]!.landmarks[0]!.x).toBe(originalX);

    // Fields preserved
    expect(smoothed[1]!.frameId).toBe(1);
    expect(smoothed[1]!.timestampMs).toBe(133);
    expect(smoothed[1]!.width).toBe(1080);
    expect(smoothed[1]!.height).toBe(1920);
    expect(smoothed[1]!.model).toBe('MEDIAPIPE_POSE');
    expect(smoothed[1]!.modelVersion).toBe('0.10.14');
    expect(smoothed[1]!.landmarks[0]!.visibility).toBe(0.95);
    expect(smoothed[1]!.landmarks[0]!.presence).toBe(0.98);
    expect(smoothed[1]!.worldLandmarks).toBeDefined();
    expect(smoothed[1]!.worldLandmarks).toHaveLength(1);
  });

  test('PoseSmoother class streaming produces identical results to smoothSequence', () => {
    const rawFrames: PoseFrame[] = [];
    for (let i = 0; i < 15; i++) {
      rawFrames.push(createMockFrame(i, i * 33.3, 0.3 + i * 0.02, 0.4 + i * 0.01));
    }

    const batchSmoothed = smoothPoseSequence(rawFrames);

    const streamer = new PoseSmoother();
    const streamSmoothed = rawFrames.map((f) => streamer.smoothFrame(f));

    for (let i = 0; i < rawFrames.length; i++) {
      expect(streamSmoothed[i]!.landmarks[0]!.x).toBeCloseTo(batchSmoothed[i]!.landmarks[0]!.x, 6);
      expect(streamSmoothed[i]!.landmarks[0]!.y).toBeCloseTo(batchSmoothed[i]!.landmarks[0]!.y, 6);
    }

    // Resetting and rerunning produces same results
    streamer.reset();
    const reStreamSmoothed = rawFrames.map((f) => streamer.smoothFrame(f));
    expect(reStreamSmoothed[5]!.landmarks[0]!.x).toBeCloseTo(streamSmoothed[5]!.landmarks[0]!.x, 6);
  });

  test('GolfSwingPhaseEngine integration with enableAdaptiveSmoothing = true', () => {
    const referenceSwing = generate240FpsSwingSequence(480, 'OPTIMAL', 'FACE_ON');

    const engine = new GolfSwingPhaseEngine({
      viewAngle: 'FACE_ON',
      enableAdaptiveSmoothing: true,
    });

    const result = engine.analyzeSequence(referenceSwing);

    // All 10 phases must be detected and strictly ordered
    expect(result.orderedEvents).toHaveLength(10);
    for (let i = 1; i < result.orderedEvents.length; i++) {
      expect(result.orderedEvents[i]!.frameIndex).toBeGreaterThan(result.orderedEvents[i - 1]!.frameIndex);
    }
    expect(result.tempo.tempoRatio).toBeGreaterThan(2.0);
    expect(result.tempo.tempoRatio).toBeLessThan(4.0);
  });
});
