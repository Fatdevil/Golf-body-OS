import { GolfSwingPhaseEngine } from '../../../../src/core/motion/phases/golf-swing-phase-engine';
import { generate240FpsSwingSequence } from '../../../../src/core/data/sample-240fps-swing';
import { LandmarkId } from '../../../../src/core/types/landmark';
import { getLandmark } from '../../../../src/core/metrics/golf-swing-metrics';

describe('P1-P10 True Geometric & Kinematic Detection', () => {
  let engine: GolfSwingPhaseEngine;

  beforeEach(() => {
    engine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
  });

  it('should find P2 (Takeaway) near hip elevation with initial thoracic turn', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    const p2Idx = result.phases.P2_TAKEAWAY.frameIndex;
    const p2Frame = frames[p2Idx];

    const lw = getLandmark(p2Frame, LandmarkId.LEFT_WRIST);
    const lh = getLandmark(p2Frame, LandmarkId.LEFT_HIP);

    expect(p2Idx).toBeGreaterThan(result.phases.P1_ADDRESS.frameIndex);
    expect(p2Idx).toBeLessThan(result.phases.P3_HALFWAY_BACK.frameIndex);

    // At P2, hands are near hip height (delta < 0.15)
    if (lw && lh) {
      expect(Math.abs(lw.y - lh.y)).toBeLessThan(0.15);
    }
  });

  it('should find P3 (Halfway Back) where lead arm is horizontal to ground', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    const p3Idx = result.phases.P3_HALFWAY_BACK.frameIndex;
    const p3Frame = frames[p3Idx];

    const ls = getLandmark(p3Frame, LandmarkId.LEFT_SHOULDER);
    const lw = getLandmark(p3Frame, LandmarkId.LEFT_WRIST);

    // At P3, lead arm is horizontal: delta Y between wrist and shoulder is small
    if (ls && lw) {
      expect(Math.abs(lw.y - ls.y)).toBeLessThan(0.12);
    }
  });

  it('should find P5 (Shallowing) where lead arm passes horizontal in downswing', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    const p5Idx = result.phases.P5_SHALLOW.frameIndex;
    const p5Frame = frames[p5Idx];

    const ls = getLandmark(p5Frame, LandmarkId.LEFT_SHOULDER);
    const lw = getLandmark(p5Frame, LandmarkId.LEFT_WRIST);

    expect(p5Idx).toBeGreaterThan(result.phases.P4_TOP.frameIndex);
    expect(p5Idx).toBeLessThan(result.phases.P6_DELIVERY.frameIndex);

    // At P5, lead arm is horizontal in downswing
    if (ls && lw) {
      expect(Math.abs(lw.y - ls.y)).toBeLessThan(0.12);
    }
  });

  it('should find P6 (Delivery) immediately before impact', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    const p6Idx = result.phases.P6_DELIVERY.frameIndex;
    const p7Idx = result.phases.P7_IMPACT.frameIndex;

    expect(p6Idx).toBeLessThan(p7Idx);
    // In 240 fps downswing, P6 occurs within 5-25 frames before impact
    expect(p7Idx - p6Idx).toBeGreaterThanOrEqual(2);
    expect(p7Idx - p6Idx).toBeLessThanOrEqual(30);
  });

  it('should accurately process downsampled 60 fps swing sequence', () => {
    const fullFrames = generate240FpsSwingSequence(480);
    // Downsample by factor of 4 (240 fps -> 60 fps = 120 frames)
    const downsampled = fullFrames.filter((_, idx) => idx % 4 === 0).map((f, i) => ({
      ...f,
      frameId: i,
      timestampMs: Math.round(i * (1000 / 60))
    }));

    const result = engine.analyzeSequence(downsampled);

    expect(result.detectedFrameRate).toBe(60);
    expect(result.orderedEvents.length).toBe(10);

    // Strictly monotonic ordering maintained even at 60 fps
    for (let i = 0; i < result.orderedEvents.length - 1; i++) {
      expect(result.orderedEvents[i].frameIndex).toBeLessThan(result.orderedEvents[i + 1].frameIndex);
    }
  });
});
