import { ConfidenceEngine, ConfidenceInput } from '../../../src/core/confidence/confidence-engine';
import { CONFIDENCE_V0_EXPERIMENTAL } from '../../../src/core/confidence/confidence-config';

describe('Confidence Engine', () => {
  let engine: ConfidenceEngine;

  beforeEach(() => {
    engine = new ConfidenceEngine();
  });

  const perfectInput: ConfidenceInput = {
    landmarkVisibility: 1.0,
    landmarkPresence: 1.0,
    cameraStability: 1.0,
    frameCoverage: 1.0,
    movementStability: 1.0,
    protocolCompliance: 1.0,
    endpointQuality: 1.0,
    repetitionConsistency: 1.0,
  };

  it('perfect inputs yield confidence near 1.0', () => {
    const result = engine.calculate(perfectInput);
    expect(result.overall).toBeCloseTo(1.0);
    expect(result.isAbstained).toBe(false);
    expect(result.flags.length).toBe(0);
    expect(result.configVersion).toBe('CONFIDENCE_V0_EXPERIMENTAL');
  });

  it('single bad signal yields reduced but passing confidence', () => {
    const input = { ...perfectInput, cameraStability: 0.2 };
    const result = engine.calculate(input);
    
    expect(result.overall).toBeLessThan(1.0);
    expect(result.overall).toBeGreaterThan(0.5);
    expect(result.isAbstained).toBe(false);
    expect(result.flags).toContain('CAMERA_UNSTABLE');
  });

  it('multiple bad signals yield abstention (< 0.5)', () => {
    const input: ConfidenceInput = {
      landmarkVisibility: 0.2,
      landmarkPresence: 0.2,
      cameraStability: 0.2,
      frameCoverage: 0.4,
      movementStability: 0.3,
      protocolCompliance: 0.4,
      endpointQuality: 0.5,
      repetitionConsistency: 0.5,
    };
    
    const result = engine.calculate(input);
    expect(result.overall).toBeLessThan(0.5);
    expect(result.isAbstained).toBe(true);
    expect(result.flags).toContain('LOW_VISIBILITY');
    expect(result.flags).toContain('CAMERA_UNSTABLE');
    expect(result.flags).toContain('LOW_FRAME_COVERAGE');
    expect(result.flags).toContain('LOW_PROTOCOL_COMPLIANCE');
    expect(result.flags).toContain('UNSTABLE_MOVEMENT');
  });

  it('custom config overrides work', () => {
    const customConfig = {
      ...CONFIDENCE_V0_EXPERIMENTAL,
      version: 'CUSTOM_V1' as const,
      abstentionThreshold: 0.8,
    };
    
    const customEngine = new ConfidenceEngine(customConfig);
    // With threshold at 0.8, we need overall < 0.8 to trigger abstention
    // Multiple weak signals bring the weighted sum below the threshold
    const input = {
      ...perfectInput,
      landmarkVisibility: 0.3,
      frameCoverage: 0.3,
      cameraStability: 0.3,
      movementStability: 0.3,
    };
    const result = customEngine.calculate(input);
    
    expect(result.configVersion).toBe('CUSTOM_V1');
    expect(result.isAbstained).toBe(true);
  });
});
