import { BodySwingCorrelator } from '../../../src/core/correlation/body-swing-correlator';
import { GolfSwingPhaseEngine } from '../../../src/core/motion/phases/golf-swing-phase-engine';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';
import { GolfBodyScoreResult } from '../../../src/core/metrics/golf-body-score';

describe('BodySwingCorrelator', () => {
  let correlator: BodySwingCorrelator;

  beforeEach(() => {
    correlator = new BodySwingCorrelator();
  });

  it('should return empty correlations if no body result is provided', () => {
    const engine = new GolfSwingPhaseEngine();
    const swingResult = engine.analyzeSequence(generate240FpsSwingSequence(480));
    const correlations = correlator.correlate(null, swingResult);
    expect(correlations).toEqual([]);
  });

  it('should correlate poor Hip Hinge with Early Extension in swing', () => {
    const engine = new GolfSwingPhaseEngine();
    const swingResult = engine.analyzeSequence(generate240FpsSwingSequence(480));

    // Add EARLY_EXTENSION fault
    swingResult.faults.push({
      id: 'EARLY_EXTENSION',
      name: { 'sv-SE': 'Early Extension', 'en-US': 'Early Extension' },
      severity: 'HIGH',
      phaseDetected: 'P7_IMPACT',
      metricValue: 12,
      threshold: 8,
      unit: '°',
      description: { 'sv-SE': 'Bäckenet skjuter mot bollen', 'en-US': 'Pelvis thrusts towards ball' },
      relatedBodyLimitation: { 'sv-SE': 'Dålig höftfällning', 'en-US': 'Poor hip hinge' }
    });

    const mockBodyResult: GolfBodyScoreResult = {
      totalScore: 58,
      tier: 'BRONZE',
      tierLabel: 'BRONZE',
      tierColor: '#cd7f32',
      hipHinge: {
        total: 24, // low score (< 38)
        score: 24,
        avgHingeAngle: 35,
        compensationsCount: 2,
        breakdown: { baseAngleScore: 14, compensationPenalty: 10 }
      },
      thoracicRotation: {
        total: 34,
        score: 34,
        maxLeft: 30,
        maxRight: 28,
        asymmetry: 2,
        compensationsCount: 1,
        breakdown: { leftScore: 16, rightScore: 18, asymmetryPenalty: 0 }
      },
      summary: 'Needs work on hip hinge stability.'
    };

    const correlations = correlator.correlate(mockBodyResult, swingResult);
    expect(correlations.length).toBeGreaterThanOrEqual(1);

    const eeCorrelation = correlations.find(c => c.relatedSwingFaultId === 'EARLY_EXTENSION');
    expect(eeCorrelation).toBeDefined();
    expect(eeCorrelation?.bodyTest).toBe('HIP_HINGE');
    expect(eeCorrelation?.title['sv-SE']).toContain('Höftfällningsbrist');
    expect(eeCorrelation?.explanation['sv-SE']).toContain('24/50');
  });

  it('should not throw when thoracic is undefined and SWAY_BACKSWING fault is detected', () => {
    const engine = new GolfSwingPhaseEngine();
    const swingResult = engine.analyzeSequence(generate240FpsSwingSequence(480));
    swingResult.faults.push({
      id: 'SWAY_BACKSWING',
      name: { 'sv-SE': 'Svaj', 'en-US': 'Sway' },
      severity: 'HIGH',
      phaseDetected: 'P4_TOP',
      metricValue: 20,
      threshold: 15,
      unit: '%',
      description: { 'sv-SE': 'Höftsvaj', 'en-US': 'Hip sway' },
      relatedBodyLimitation: { 'sv-SE': 'Stelhet', 'en-US': 'Stiffness' }
    });

    const bodyWithoutThoracic: any = {
      totalScore: 50,
      hipHinge: { total: 30, score: 30 }
    };

    expect(() => {
      correlator.correlate(bodyWithoutThoracic, swingResult);
    }).not.toThrow();
  });

  it('frames every correlation as a possible contributing factor, never as a cause', () => {
    const engine = new GolfSwingPhaseEngine();
    const swingResult = engine.analyzeSequence(generate240FpsSwingSequence(480));
    const fault = (id: string, phase: any) => ({
      id, name: { 'sv-SE': id, 'en-US': id }, severity: 'HIGH' as const, phaseDetected: phase,
      metricValue: 20, threshold: 10, unit: '°',
      description: { 'sv-SE': id, 'en-US': id }, relatedBodyLimitation: { 'sv-SE': id, 'en-US': id },
    });
    swingResult.faults.push(
      fault('EARLY_EXTENSION', 'P7_IMPACT') as any,
      fault('OVER_ROTATION_PELVIS', 'P4_TOP') as any,
      fault('REVERSE_SPINE', 'P4_TOP') as any,
      fault('SWAY_BACKSWING', 'P4_TOP') as any,
    );
    const body: any = {
      totalScore: 40,
      hipHinge: { total: 20, score: 20 },
      thoracicRotation: { total: 20, score: 20, maxLeft: 20, maxRight: 35, asymmetry: 15 },
    };

    const correlations = correlator.correlate(body, swingResult);
    expect(correlations).toHaveLength(4);

    const causal = /\b(causes?|caused|forces?|explains?|because)\b|orsakar|tvingar|tvingas|förklarar|eftersom|skapar/i;
    for (const c of correlations) {
      for (const lang of ['sv-SE', 'en-US'] as const) {
        expect(c.title[lang]).not.toMatch(causal);
        expect(c.explanation[lang]).not.toMatch(causal);
      }
      expect(c.title['sv-SE']).toContain('kan bidra');
      expect(c.title['en-US']).toContain('may contribute');
    }
  });
});
