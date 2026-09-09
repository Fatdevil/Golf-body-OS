import {
  computeTransverseTurn,
  computeSpineInclination,
  detectSwingFaults,
  calculateSwingTempo
} from '../../../src/core/metrics/golf-swing-metrics';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';
import { GolfSwingPhaseEngine } from '../../../src/core/motion/phases/golf-swing-phase-engine';

describe('GolfSwingMetrics', () => {
  it('should compute transverse turn correctly', () => {
    // Both points on same Z = 0°
    const turn0 = computeTransverseTurn({ x: 0.4, z: 0 }, { x: 0.6, z: 0 }, true);
    expect(turn0).toBe(0);

    // Right shoulder forward (+Z), left back (-Z) = backswing turn
    const turnBack = computeTransverseTurn({ x: 0.45, z: -0.05 }, { x: 0.55, z: 0.05 }, true);
    expect(turnBack).toBeGreaterThan(0);
  });

  it('should compute spine inclination from frame', () => {
    const frames = generate240FpsSwingSequence(50);
    const inc = computeSpineInclination(frames[0], 'FACE_ON');
    expect(typeof inc).toBe('number');
  });

  it('should calculate tempo with expected ratings', () => {
    // 900ms backswing, 300ms downswing -> 3.0:1 (EXCELLENT)
    const t1 = calculateSwingTempo({ timestampMs: 0 }, { timestampMs: 900 }, { timestampMs: 1200 });
    expect(t1.tempoRatio).toBe(3.0);
    expect(t1.rating).toBe('EXCELLENT');

    // Fast backswing (400ms backswing, 250ms downswing -> 1.6:1)
    const t2 = calculateSwingTempo({ timestampMs: 0 }, { timestampMs: 400 }, { timestampMs: 650 });
    expect(t2.rating).toBe('FAST_BACKSWING');
  });

  it('should detect Early Extension when spine straightening exceeds threshold', () => {
    const engine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    // Artificially inject early extension spine loss
    const modifiedKinematics = {
      ...result.kinematics,
      P7_IMPACT: {
        ...result.kinematics.P7_IMPACT,
        spineAngleDelta: 14.5, // Straightened up 14.5 degrees
        pelvisThrust: 12
      }
    };

    const faults = detectSwingFaults(modifiedKinematics, 'FACE_ON');
    const ee = faults.find(f => f.id === 'EARLY_EXTENSION');
    expect(ee).toBeDefined();
    expect(ee?.phaseDetected).toBe('P7_IMPACT');
    expect(ee?.severity).toBe('HIGH');
  });
});
