import { AiCoachService } from '../../../src/core/ai/ai-coach-service';
import { DeviceValidationReport } from '../../../src/validation/device-validation-report';
import { buildAnalysisPrompt } from '../../../src/core/ai/golf-coach-prompts';

describe('AiCoachService', () => {
  let service: AiCoachService;

  const mockReport: DeviceValidationReport = {
    status: 'SUCCESS',
    device: { model: 'Test Device', osVersion: '1.0' },
    model: { variant: 'FULL', runtimeVersion: '0.10.14', assetVersion: '1', sha256: 'abc' },
    capture: {
      resolution: '640x480',
      cameraFps: 30,
      processedFps: 30,
      durationMs: 15000,
      rawFrameCount: 450,
      processedFrameCount: 450,
      droppedFrameCount: 0,
      sourceDecodedFrameCount: 450,
      poseInferenceFrameCount: 450,
      presentedFrameCallbacks: 450,
      missedPresentedFrames: 0,
      duplicateMediaTimestamps: 0
    },
    inference: { meanLatencyMs: null, p50LatencyMs: null, p95LatencyMs: null, maxLatencyMs: null },
    landmarks: { expectedPerPose: 33, validPoseFrameCount: 450, rejectedPoseFrameCount: 0, interpolatedGapCount: 0 },
    measurement: {
      detectedRepCount: 3,
      validRepCount: 3,
      metrics: [
        { id: 'HIP_HINGE_ANGLE_2D', value: 76.5, unit: 'degrees', confidence: 0.95 },
        { id: 'TRUNK_INCLINATION', value: 75.0, unit: 'degrees', confidence: 0.95 },
        { id: 'KNEE_ANGLE_AT_ENDPOINT', value: 146.0, unit: 'degrees', confidence: 0.95 },
        { id: 'SHANK_INCLINATION', value: 4.5, unit: 'degrees', confidence: 0.95 },
        { id: 'POSTERIOR_HIP_SHIFT', value: 0.2, unit: 'ratio', confidence: 0.95 }
      ],
      compensations: [
        { type: 'CERVICAL_CRANING', severity: 'WARNING' }
      ],
      confidence: 0.92,
      qualityFlags: []
    },
    failureCodes: [],
    trace: {} as any
  };

  beforeEach(() => {
    service = new AiCoachService();
  });

  it('manages API key state correctly', () => {
    expect(service.hasApiKey()).toBe(false);
    service.setApiKey('test_key_123');
    expect(service.hasApiKey()).toBe(true);
    expect(service.getApiKey()).toBe('test_key_123');
    service.setApiKey('');
    expect(service.hasApiKey()).toBe(false);
  });

  it('synthesizes high quality Swedish analysis locally when no API key is set', async () => {
    const analysis = await service.generateAnalysis(mockReport, [], 'sv-SE');
    expect(analysis.engineUsed).toBe('LOCAL_EXPERT_SYNTHESIZER');
    expect(analysis.language).toBe('sv-SE');
    expect(analysis.headline).toBeTruthy();
    expect(analysis.summary).toContain('höftfällningsvinkel');
    expect(analysis.golfTranslation.title).toBeTruthy();
    expect(analysis.golfTranslation.explanation).toBeTruthy();
    expect(analysis.exercises.length).toBeGreaterThanOrEqual(2);
    expect(analysis.proTip).toBeTruthy();
  });

  it('synthesizes high quality English analysis locally', async () => {
    const analysis = await service.generateAnalysis(mockReport, [], 'en-US');
    expect(analysis.language).toBe('en-US');
    expect(analysis.summary).toContain('hip hinge angle');
    expect(analysis.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it('correctly adapts analysis to detected compensations', async () => {
    const analysis = await service.generateAnalysis(mockReport, [], 'sv-SE');
    // Mock report has CERVICAL_CRANING -> should address neck in golf translation or exercises
    const addressesNeck = 
      analysis.golfTranslation.title.includes('Nack') || 
      analysis.exercises.some(e => e.name.toLowerCase().includes('nack') || e.name.toLowerCase().includes('tennisboll'));
    expect(addressesNeck).toBe(true);
  });

  it('answers interactive questions using local expert knowledge', async () => {
    const replyBack = await service.chat([{ id: '1', role: 'user', content: 'Varför kände jag av ländryggen?', timestamp: 1 }], mockReport, 'sv-SE');
    expect(replyBack.toLowerCase()).toContain('ländrygg');

    const replySetup = await service.chat([{ id: '2', role: 'user', content: 'Hur ska min golfuppställning se ut?', timestamp: 2 }], mockReport, 'sv-SE');
    expect(replySetup.toLowerCase()).toContain('golfuppställning');
  });

  it('formats LLM prompts correctly with report data and cues', () => {
    const prompt = buildAnalysisPrompt(mockReport, [
      { key: 'CUE_NEUTRAL_NECK', text: 'Håll nacken rak', language: 'sv-SE', priority: 'NORMAL', timestampMs: 5000 }
    ], 'sv-SE');

    expect(prompt).toContain('Overall Confidence: 92%');
    expect(prompt).toContain('CERVICAL_CRANING');
    expect(prompt).toContain('CUE_NEUTRAL_NECK');
    expect(prompt).toContain('Swedish');
  });

  it('generates high quality rotation analysis with local expert engine', async () => {
    const service = new AiCoachService();
    const rotationResult = {
      maxRotationLeft: 52.0,
      maxRotationRight: 48.0,
      rotationAsymmetry: 4.0,
      totalShoulderTurnLeft: 65.0,
      totalShoulderTurnRight: 60.0,
      pelvicTurnAtPeakLeft: 13.0,
      pelvicTurnAtPeakRight: 12.0,
      compensations: {
        excessiveLateralTilt: false,
        excessivePelvicRotation: false,
        severeAsymmetry: false,
      },
    };

    const analysis = await service.generateRotationAnalysis(rotationResult, [], 'sv-SE');
    expect(analysis.headline).toContain('rotationsrörlighet');
    expect(analysis.exercises.length).toBeGreaterThanOrEqual(2);
    expect(analysis.golfTranslation.title).toContain('X-Factor');
    expect(analysis.engineUsed).toBe('LOCAL_EXPERT_SYNTHESIZER');
  });

  it('generates high quality holistic screening analysis and 3 priority drills', async () => {
    const service = new AiCoachService();
    const rotationResult = {
      maxRotationLeft: 46.0,
      maxRotationRight: 44.0,
      rotationAsymmetry: 2.0,
      totalShoulderTurnLeft: 60.0,
      totalShoulderTurnRight: 58.0,
      pelvicTurnAtPeakLeft: 14.0,
      pelvicTurnAtPeakRight: 14.0,
      compensations: {
        excessiveLateralTilt: false,
        excessivePelvicRotation: false,
        severeAsymmetry: false,
      },
    };

    const { calculateGolfBodyScore } = require('../../../src/core/metrics/golf-body-score');
    const score = calculateGolfBodyScore(mockReport, rotationResult, 'sv-SE');

    const analysis = await service.generateHolisticScreeningAnalysis(mockReport, rotationResult, score, [], 'sv-SE');

    expect(analysis.engineUsed).toBe('LOCAL_EXPERT_SYNTHESIZER');
    expect(analysis.headline).toContain('Tour-nivå');
    expect(analysis.summary).toContain('Golf Body Score');
    expect(analysis.exercises.length).toBe(3); // Wall Tap RDL, Thoracic Open Books, Golf Posture Disassociation
    expect(analysis.exercises[0].target).toContain('Pelare A');
    expect(analysis.exercises[1].target).toContain('Pelare B');
    expect(analysis.exercises[2].target).toContain('Helhet');
    expect(analysis.golfTranslation.title).toContain('Golf-SWOT');
    expect(analysis.proTip).toContain('Range Pro Tip');

    // Test holistic chat Q&A
    const reply = await service.chat(
      [{ id: '1', role: 'user', content: 'Hur hänger mina resultat ihop i svingen?', timestamp: 1 }],
      mockReport,
      'sv-SE',
      rotationResult,
      score
    );
    expect(reply).toMatch(/Early Extension|övergripande|bröstrygg|höftfällning/i);
  });
});

