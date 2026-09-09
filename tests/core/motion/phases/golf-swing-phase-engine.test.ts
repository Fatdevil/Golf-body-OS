import { GolfSwingPhaseEngine } from '../../../../src/core/motion/phases/golf-swing-phase-engine';
import { generate240FpsSwingSequence } from '../../../../src/core/data/sample-240fps-swing';
import { ORDERED_SWING_PHASES } from '../../../../src/core/types/golf-swing';

describe('GolfSwingPhaseEngine', () => {
  let engine: GolfSwingPhaseEngine;

  beforeEach(() => {
    engine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
  });

  it('should reject sequences with insufficient frames', () => {
    expect(() => engine.analyzeSequence([])).toThrow('minimum 15 required');
  });

  it('should detect all 10 P-positions on a 240 fps swing sequence', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    expect(result.detectedFrameRate).toBe(240);
    expect(result.totalFramesAnalyzed).toBe(480);
    expect(result.orderedEvents.length).toBe(10);

    // Verify all 10 phases exist
    for (const phaseId of ORDERED_SWING_PHASES) {
      expect(result.phases[phaseId]).toBeDefined();
      expect(result.phases[phaseId].phaseId).toBe(phaseId);
      expect(result.kinematics[phaseId]).toBeDefined();
    }
  });

  it('should preserve strictly increasing temporal order for all 10 phases', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    const p1 = result.phases.P1_ADDRESS.frameIndex;
    const p2 = result.phases.P2_TAKEAWAY.frameIndex;
    const p3 = result.phases.P3_HALFWAY_BACK.frameIndex;
    const p4 = result.phases.P4_TOP.frameIndex;
    const p5 = result.phases.P5_SHALLOW.frameIndex;
    const p6 = result.phases.P6_DELIVERY.frameIndex;
    const p7 = result.phases.P7_IMPACT.frameIndex;
    const p8 = result.phases.P8_RELEASE.frameIndex;
    const p9 = result.phases.P9_REHINGE.frameIndex;
    const p10 = result.phases.P10_FINISH.frameIndex;

    expect(p1).toBeLessThan(p2);
    expect(p2).toBeLessThan(p3);
    expect(p3).toBeLessThan(p4);
    expect(p4).toBeLessThan(p5);
    expect(p5).toBeLessThan(p6);
    expect(p6).toBeLessThan(p7);
    expect(p7).toBeLessThan(p8);
    expect(p8).toBeLessThan(p9);
    expect(p9).toBeLessThan(p10);
  });

  it('should calculate realistic golf swing tempo ratio', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    expect(result.tempo.backswingDurationMs).toBeGreaterThan(500);
    expect(result.tempo.downswingDurationMs).toBeGreaterThan(150);
    expect(result.tempo.downswingDurationMs).toBeLessThan(result.tempo.backswingDurationMs);
    // Tempo ratio should be approximately 3.0:1
    expect(result.tempo.tempoRatio).toBeGreaterThanOrEqual(2.0);
    expect(result.tempo.tempoRatio).toBeLessThanOrEqual(4.5);
  });

  it('should extract valid kinematics for P4 (Top) and P7 (Impact)', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    const top = result.kinematics.P4_TOP;
    const impact = result.kinematics.P7_IMPACT;

    // At top of backswing, shoulders and pelvis are rotated
    expect(top.shoulderTurn).toBeGreaterThan(60);
    expect(top.pelvisTurn).toBeGreaterThan(25);
    expect(top.xFactor).toBeGreaterThan(20);

    // At impact, shoulders and hips have cleared
    expect(impact.pelvisTurn).toBeDefined();
    expect(impact.shoulderTurn).toBeDefined();
  });
});
