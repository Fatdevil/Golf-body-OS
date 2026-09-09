import { calculateGolfBodyScore } from '../../../src/core/metrics/golf-body-score';
import { DeviceValidationReport } from '../../../src/validation/device-validation-report';
import { ThoracicRotationResult } from '../../../src/core/metrics/thoracic-rotation-metrics';

function createMockHingeReport(options: {
  hingeAngles?: number[];
  kneeAngles?: number[];
  compensations?: Array<{ type: any; severity: any }>;
}): DeviceValidationReport {
  const hingeAngles = options.hingeAngles || [78, 76, 75];
  const kneeAngles = options.kneeAngles || [158, 157, 159];
  const comps = options.compensations || [];

  return {
    status: 'SUCCESS',
    device: { model: 'MacBookPro', osVersion: 'macOS' },
    model: { variant: 'FULL', assetVersion: null, runtimeVersion: '1.0', sha256: 'mock' },
    capture: {
      resolution: '1280x720',
      cameraFps: 30,
      processedFps: 30,
      durationMs: 4000,
      rawFrameCount: 120,
      processedFrameCount: 120,
      droppedFrameCount: 0,
      sourceDecodedFrameCount: 120,
      poseInferenceFrameCount: 120,
      presentedFrameCallbacks: 120,
      missedPresentedFrames: 0,
      duplicateMediaTimestamps: 0,
    },
    inference: { meanLatencyMs: 12, p50LatencyMs: 12, p95LatencyMs: 15, maxLatencyMs: 18 },
    landmarks: { expectedPerPose: 33, validPoseFrameCount: 120, rejectedPoseFrameCount: 0, interpolatedGapCount: 0 },
    measurement: {
      detectedRepCount: hingeAngles.length,
      validRepCount: hingeAngles.length,
      metrics: [
        ...hingeAngles.map(val => ({ id: 'HIP_HINGE_ANGLE_2D', value: val, unit: 'degrees' as const, validationStatus: 'EXPERIMENTAL' as const })),
        ...kneeAngles.map(val => ({ id: 'KNEE_ANGLE_AT_ENDPOINT', value: val, unit: 'degrees' as const, validationStatus: 'EXPERIMENTAL' as const })),
      ],
      compensations: comps.map(c => ({
        type: c.type,
        severity: c.severity,
        description: 'Mock compensation',
        triggeredRule: 'MOCK_RULE',
        observedValue: 0,
        threshold: 0,
        unit: 'degrees',
        repIndex: 1,
      })),
      confidence: 0.95,
      qualityFlags: [],
    },
    failureCodes: [],
    trace: {
      events: [],
      performance: { meanProcessingLatencyMs: 12, p95ProcessingLatencyMs: 15, maxProcessingLatencyMs: 18, frameDrops: 0 },
      anomalies: [],
      dataIntegrityVerified: true,
      coordinateSystemVerified: true,
    },
  };
}

function createMockRotationResult(overrides: Partial<ThoracicRotationResult> = {}): ThoracicRotationResult {
  return {
    maxRotationLeft: 48,
    maxRotationRight: 47,
    rotationAsymmetry: 1,
    totalShoulderTurnLeft: 70,
    totalShoulderTurnRight: 69,
    pelvicTurnAtPeakLeft: 12,
    pelvicTurnAtPeakRight: 11,
    compensations: {
      excessiveLateralTilt: false,
      excessivePelvicRotation: false,
      severeAsymmetry: false,
    },
    ...overrides,
  };
}

describe('Golf Body Score Engine', () => {
  it('computes near-perfect 95-100 score for elite mobility with no compensations', () => {
    const hingeReport = createMockHingeReport({
      hingeAngles: [78, 77, 76],
      kneeAngles: [156, 157, 158],
      compensations: [],
    });
    const rotationResult = createMockRotationResult({
      maxRotationLeft: 52,
      maxRotationRight: 50,
      rotationAsymmetry: 2,
      pelvicTurnAtPeakLeft: 10,
      pelvicTurnAtPeakRight: 9,
    });

    const result = calculateGolfBodyScore(hingeReport, rotationResult, 'sv-SE');

    expect(result.totalScore).toBeGreaterThanOrEqual(95);
    expect(result.tier).toBe('TOUR_ELITE');
    expect(result.tierLabel).toBe('Tour-nivå');
    expect(result.hipHinge.total).toBe(50);
    expect(result.thoracic.total).toBe(50);
    expect(result.keyStrengths.length).toBeGreaterThanOrEqual(3);
    expect(result.primaryBottlenecks).toContain('Inga allvarliga rörelsebegränsningar identifierade');
  });

  it('deducts points and identifies bottlenecks when compensations are present', () => {
    const hingeReport = createMockHingeReport({
      hingeAngles: [110, 112, 115], // Restricted hinge
      kneeAngles: [130, 128, 132],  // Squatting
      compensations: [
        { type: 'EXCESSIVE_KNEE_BEND', severity: 'FAIL' },
        { type: 'CERVICAL_CRANING', severity: 'WARNING' },
      ],
    });
    const rotationResult = createMockRotationResult({
      maxRotationLeft: 28,
      maxRotationRight: 14,
      rotationAsymmetry: 14,
      pelvicTurnAtPeakLeft: 30,
      pelvicTurnAtPeakRight: 28,
      compensations: {
        excessiveLateralTilt: true,
        excessivePelvicRotation: true,
        severeAsymmetry: false,
      },
    });

    const result = calculateGolfBodyScore(hingeReport, rotationResult, 'sv-SE');

    expect(result.totalScore).toBeLessThan(60);
    expect(result.tier).toBe('RESTRICTED');
    expect(result.tierLabel).toBe('Betydande Begränsning');
    expect(result.hipHinge.total).toBeLessThan(25);
    expect(result.thoracic.total).toBeLessThan(25);

    // Primary bottlenecks should catch both hinge and rotation compensations
    const bottlenecksJoined = result.primaryBottlenecks.join(' ');
    expect(bottlenecksJoined).toMatch(/Early Extension|knäböj/i);
    expect(bottlenecksJoined).toMatch(/Nacklyft|nacken/i);
    expect(bottlenecksJoined).toMatch(/Höften snurrar|X-Factor/i);
    expect(bottlenecksJoined).toMatch(/dip|sway/i);
  });

  it('accurately computes Solid tier (75-89) for good mobility with minor limitations', () => {
    const hingeReport = createMockHingeReport({
      hingeAngles: [95, 96, 94], // 21 pts depth
      kneeAngles: [154, 155, 156], // 15 pts knee
      compensations: [], // 10 pts spine -> 46 pts
    });
    const rotationResult = createMockRotationResult({
      maxRotationLeft: 35,
      maxRotationRight: 33, // ~17.7 pts rotation
      rotationAsymmetry: 2, // 5 pts symmetry
      pelvicTurnAtPeakLeft: 16,
      pelvicTurnAtPeakRight: 15, // ~14 pts pelvic
      compensations: {
        excessiveLateralTilt: false,
        excessivePelvicRotation: false,
        severeAsymmetry: false,
      }, // 5 pts dip
    });

    const result = calculateGolfBodyScore(hingeReport, rotationResult, 'en-US');

    expect(result.totalScore).toBeGreaterThanOrEqual(75);
    expect(result.totalScore).toBeLessThanOrEqual(89);
    expect(result.tier).toBe('SOLID');
    expect(result.tierLabel).toBe('Solid Athletic');
    expect(result.summary).toContain('Solid Athletic');
  });

  it('handles null reports gracefully without throwing', () => {
    const result = calculateGolfBodyScore(null, null, 'sv-SE');

    expect(result.totalScore).toBe(0);
    expect(result.tier).toBe('RESTRICTED');
    expect(result.hipHinge.total).toBe(0);
    expect(result.thoracic.total).toBe(0);
    expect(typeof result.summary).toBe('string');
  });
});
