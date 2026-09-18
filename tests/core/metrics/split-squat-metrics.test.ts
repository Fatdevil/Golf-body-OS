/**
 * Unit tests for Split Squat Capacity Test Suite
 *
 * Validates:
 * 1. SplitSquatPhaseEngine repetition state machine
 * 2. Biomechanical metrics, valid rep filtering, and fatigue onset
 * 3. Left/Right asymmetry detection
 * 4. Integration with BodyProfile capacity domain
 */

import {
  SplitSquatPhaseEngine,
  type SplitSquatRepetition,
} from '../../../src/core/motion/phases/split-squat-phase-engine';
import {
  evaluateSplitSquatSet,
  evaluateSplitSquatAsymmetry,
  type SplitSquatSetResult,
} from '../../../src/core/metrics/split-squat-metrics';
import {
  applySplitSquatAssessment,
  screeningToProfile,
  type SplitSquatAssessmentData,
} from '../../../src/core/training/adapters/screening-to-profile';
import type { GolfBodyScoreResult } from '../../../src/core/metrics/golf-body-score';

describe('Split Squat Phase Engine', () => {
  it('detects a completed deep repetition', () => {
    const engine = new SplitSquatPhaseEngine({ inflectionWindowFrames: 1 });

    // 1. Standing in ready position (knee ~165°)
    engine.processFrame(1, 0, 165, 5);
    expect(engine.currentPhase).toBe('READY');

    // 2. Initiates descent (knee drops to 140°)
    engine.processFrame(2, 300, 140, 6);
    expect(engine.currentPhase).toBe('DESCENT');

    // 3. Reaches bottom depth (knee reaches 90°)
    engine.processFrame(3, 800, 90, 8);
    expect(engine.currentPhase).toBe('DESCENT');

    // 4. Starts ascending (knee rises to 105°)
    engine.processFrame(4, 1100, 105, 8);
    expect(engine.currentPhase).toBe('ASCENT');

    // 5. Reaches lockout / top (knee returns to 160°)
    engine.processFrame(5, 1600, 160, 5);
    expect(engine.currentPhase).toBe('READY');
    expect(engine.totalRepCount).toBe(1);
    expect(engine.validRepCount).toBe(1);

    const rep = engine.completedReps[0]!;
    expect(rep.minKneeAngleDeg).toBe(90);
    expect(rep.isValidDepth).toBe(true);
    expect(rep.descentDurationMs).toBe(800);
    expect(rep.ascentDurationMs).toBe(800);
  });

  it('marks shallow reps as invalid', () => {
    const engine = new SplitSquatPhaseEngine({ inflectionWindowFrames: 1 });

    // Rep 1: Shallow (reaches only 120°, threshold is 100°)
    engine.processFrame(1, 0, 165);
    engine.processFrame(2, 300, 140);
    engine.processFrame(3, 600, 120); // bottom
    engine.processFrame(4, 900, 135); // ascending
    engine.processFrame(5, 1300, 160); // standing

    expect(engine.totalRepCount).toBe(1);
    expect(engine.validRepCount).toBe(0);
    expect(engine.completedReps[0]!.isValidDepth).toBe(false);
  });

  it('terminates test after prolonged inactivity in standing', () => {
    const engine = new SplitSquatPhaseEngine({ maxIdleDurationMs: 2000, inflectionWindowFrames: 1 });

    // Complete 1 rep
    engine.processFrame(1, 0, 165);
    engine.processFrame(2, 400, 130);
    engine.processFrame(3, 800, 90);
    engine.processFrame(4, 1200, 110);
    engine.processFrame(5, 1600, 160);

    expect(engine.totalRepCount).toBe(1);
    expect(engine.terminated).toBe(false);

    // Inactive in standing for 2500ms
    engine.processFrame(6, 4200, 160);
    expect(engine.terminated).toBe(true);
    expect(engine.currentPhase).toBe('TERMINATED');
  });
});

describe('Split Squat Metrics & Evaluation', () => {
  function makeMockRep(
    repIndex: number,
    minKneeAngleDeg: number,
    trunkAngleAtBottomDeg: number = 8,
    durationMs: number = 1800
  ): SplitSquatRepetition {
    return {
      repIndex,
      startFrameId: (repIndex - 1) * 30,
      bottomFrameId: (repIndex - 1) * 30 + 15,
      endFrameId: repIndex * 30,
      startTimestampMs: (repIndex - 1) * durationMs,
      bottomTimestampMs: (repIndex - 1) * durationMs + durationMs / 2,
      endTimestampMs: repIndex * durationMs,
      descentDurationMs: durationMs / 2,
      ascentDurationMs: durationMs / 2,
      minKneeAngleDeg,
      trunkAngleAtBottomDeg,
      isValidDepth: minKneeAngleDeg <= 100,
    };
  }

  it('evaluates clean, consistent set with EXCELLENT quality', () => {
    const reps: SplitSquatRepetition[] = [
      makeMockRep(1, 88),
      makeMockRep(2, 90),
      makeMockRep(3, 89),
      makeMockRep(4, 91),
      makeMockRep(5, 90),
      makeMockRep(6, 90),
      makeMockRep(7, 89),
      makeMockRep(8, 92),
      makeMockRep(9, 90),
      makeMockRep(10, 91),
      makeMockRep(11, 89),
      makeMockRep(12, 90),
    ];

    const result = evaluateSplitSquatSet('LEFT', reps);

    expect(result.totalReps).toBe(12);
    expect(result.validReps).toBe(12);
    expect(result.quality).toBe('EXCELLENT');
    expect(result.depthConsistencyScore).toBeGreaterThanOrEqual(85);
    expect(result.fatiguePointRep).toBeNull();
    expect(result.compensations).toHaveLength(0);
  });

  it('detects early fatigue and forward trunk lean', () => {
    const reps: SplitSquatRepetition[] = [
      makeMockRep(1, 85, 8),
      makeMockRep(2, 86, 10),
      makeMockRep(3, 87, 10),
      // Rep 4: Fatigue strikes - depth degrades by 20° and trunk leans forward 30°
      makeMockRep(4, 110, 32),
      makeMockRep(5, 115, 35),
    ];

    const result = evaluateSplitSquatSet('RIGHT', reps);

    expect(result.totalReps).toBe(5);
    expect(result.validReps).toBe(3); // only first 3 met depth <= 100°
    expect(result.fatiguePointRep).toBe(4);
    expect(result.compensations).toContain('SHALLOW_DEPTH');
    expect(result.compensations).toContain('EARLY_FATIGUE_DROPOFF');
  });

  it('evaluates functional asymmetry between legs', () => {
    const strongLeg: SplitSquatSetResult = {
      side: 'LEFT',
      totalReps: 12,
      validReps: 12,
      averageDepthDeg: 90,
      depthConsistencyScore: 90,
      tempoConsistencyScore: 85,
      fatiguePointRep: null,
      quality: 'EXCELLENT',
      compensations: [],
      reps: [],
    };

    const weakLeg: SplitSquatSetResult = {
      side: 'RIGHT',
      totalReps: 7,
      validReps: 6,
      averageDepthDeg: 102,
      depthConsistencyScore: 65,
      tempoConsistencyScore: 60,
      fatiguePointRep: 5,
      quality: 'FAIR',
      compensations: ['SHALLOW_DEPTH'],
      reps: [],
    };

    const asymmetry = evaluateSplitSquatAsymmetry(strongLeg, weakLeg);

    expect(asymmetry.repDifference).toBe(6);
    expect(asymmetry.dominantSide).toBe('LEFT');
    expect(asymmetry.asymmetryPercentage).toBe(50);
    expect(asymmetry.severity).toBe('SIGNIFICANT');
    expect(asymmetry.findingDescription).toBeDefined();
  });
});

describe('Capacity Integration with BodyProfile', () => {
  const mockScreeningScore: GolfBodyScoreResult = {
    totalScore: 75,
    tier: 'SOLID',
    hipHinge: {
      total: 35,
      depthScore: 20,
      kneeScore: 10,
      spineScore: 5,
      avgHingeAngle: 85,
      avgKneeAngle: 160,
      compensations: [],
    },
    thoracic: {
      total: 40,
      rotationScore: 20,
      disassociationScore: 15,
      symmetryScore: 5,
      maxLeft: 45,
      maxRight: 45,
      maxPelvicTurn: 10,
      asymmetry: 0,
      hasExcessivePelvic: false,
    },
    timestamp: new Date(),
  };

  it('leaves capacity as NOT_TESTED when no capacity data is provided', () => {
    const profile = screeningToProfile(mockScreeningScore, 'test-user');

    expect(profile.capacity.status).toBe('NOT_TESTED');
    expect(profile.capacity.compositeScore).toBe(0);
    expect(profile.capacity.areas).toHaveLength(0);
  });

  it('updates capacity to MEASURED and flags asymmetry when capacity test is passed', () => {
    const capacityData: SplitSquatAssessmentData = {
      left: {
        side: 'LEFT',
        totalReps: 12,
        validReps: 12,
        averageDepthDeg: 90,
        depthConsistencyScore: 85,
        tempoConsistencyScore: 80,
        fatiguePointRep: null,
        quality: 'EXCELLENT',
        compensations: [],
        reps: [],
      },
      right: {
        side: 'RIGHT',
        totalReps: 7,
        validReps: 6,
        averageDepthDeg: 100,
        depthConsistencyScore: 65,
        tempoConsistencyScore: 60,
        fatiguePointRep: 4,
        quality: 'FAIR',
        compensations: ['SHALLOW_DEPTH'],
        reps: [],
      },
    };

    const baseProfile = screeningToProfile(mockScreeningScore, 'test-user');
    const updatedProfile = applySplitSquatAssessment(baseProfile, capacityData);

    expect(updatedProfile.capacity.status).toBe('MEASURED');
    expect(updatedProfile.capacity.confidence).toBe('HIGH');
    expect(updatedProfile.capacity.areas).toHaveLength(2);

    const leftArea = updatedProfile.capacity.areas.find(a => a.areaId === 'split-squat-capacity-left');
    const rightArea = updatedProfile.capacity.areas.find(a => a.areaId === 'split-squat-capacity-right');
    expect(leftArea).toBeDefined();
    expect(rightArea).toBeDefined();
    expect(leftArea?.score).toBeGreaterThan(rightArea?.score ?? 0);

    // Verify bottleneck generation for asymmetry
    const asymmetryBottleneck = updatedProfile.primaryBottlenecks.find(b => b.id === 'split-squat-asymmetry');
    expect(asymmetryBottleneck).toBeDefined();
    expect(asymmetryBottleneck?.domain).toBe('CAPACITY');
    expect(asymmetryBottleneck?.type).toBe('ASYMMETRY');
    expect(asymmetryBottleneck?.severity).toBe('SIGNIFICANT');
  });
});
