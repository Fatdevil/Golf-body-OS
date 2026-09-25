/**
 * phase-engine-quality-gate.test.ts
 * Integration tests for Video Quality Gate in GolfSwingPhaseEngine.
 */

import { GolfSwingPhaseEngine } from '../../../src/core/motion/phases/golf-swing-phase-engine';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';

describe('GolfSwingPhaseEngine Quality Gate Integration', () => {
  const referenceSwing = generate240FpsSwingSequence(480, 'OPTIMAL', 'FACE_ON');

  test('validateQuality should return quality result without modifying engine state', () => {
    const engine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
    const quality = engine.validateQuality(referenceSwing, { width: 1080, height: 1920 });

    expect(quality.overallStatus).toBe('PASS');
    expect(quality.confidence).toBeGreaterThan(0.85);
    expect(quality.analysisRecommended).toBe(true);
  });

  test('should attach quality result when enforceQualityGate is true on valid sequence', () => {
    const engine = new GolfSwingPhaseEngine({
      viewAngle: 'FACE_ON',
      enforceQualityGate: true,
    });

    const result = engine.analyzeSequence(referenceSwing, { width: 1080, height: 1920 });

    expect(result.quality).toBeDefined();
    expect(result.quality?.overallStatus).toBe('PASS');
    expect(result.overallSwingScore).toBeGreaterThanOrEqual(25);
  });

  test('should reject sequence with error when enforceQualityGate is true and quality is FAIL', () => {
    const engine = new GolfSwingPhaseEngine({
      viewAngle: 'FACE_ON',
      enforceQualityGate: true,
    });

    // Too short video (< 1.0s)
    const shortClip = referenceSwing.slice(0, 30);

    expect(() => {
      engine.analyzeSequence(shortClip, { durationSec: 0.4 });
    }).toThrow(/Video Quality Gate rejected sequence/);
  });

  test('should NOT reject sequence when enforceQualityGate is false (default)', () => {
    const engine = new GolfSwingPhaseEngine({
      viewAngle: 'FACE_ON',
      enforceQualityGate: false,
    });

    const shortClip = referenceSwing.slice(0, 40);

    // Default engine analyzes if frames >= 15 even if quality gate would have warned/failed
    expect(() => {
      engine.analyzeSequence(shortClip);
    }).not.toThrow(/Video Quality Gate rejected sequence/);
  });
});
