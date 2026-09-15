import {
  computeTransverseTurn,
  computeSpineInclination,
  detectSwingFaults,
  calculateSwingTempo,
  extractPhaseKinematics
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

  it('should compute DTL spine inclination correctly for profile posture', () => {
    const dtlFrames = generate240FpsSwingSequence(50, 'OPTIMAL', 'DOWN_THE_LINE');
    const inc = computeSpineInclination(dtlFrames[0], 'DOWN_THE_LINE');
    // Athletic forward tilt is typically ~30-36° from vertical
    expect(inc).toBeGreaterThan(25);
    expect(inc).toBeLessThan(40);
  });

  it('should compute transverse turn > 90° without artificial clipping or sign reflection', () => {
    // Shoulders rotated past 90 degrees (dx < 0, dz > 0)
    // Left shoulder at (0.55, -0.1), Right shoulder at (0.45, 0.2)
    // dx = -0.1, dz = 0.3 -> atan2(0.3, -0.1) ≈ 108°
    const turnPast90Right = computeTransverseTurn({ x: 0.55, z: -0.1 }, { x: 0.45, z: 0.2 }, true);
    expect(Math.round(turnPast90Right)).toBe(108);
    expect(turnPast90Right).toBeGreaterThan(90);

    const turnPast90Left = computeTransverseTurn({ x: 0.55, z: -0.1 }, { x: 0.45, z: 0.2 }, false);
    expect(Math.round(turnPast90Left)).toBe(-108);

    // Left-handed golfer turned into backswing past 90 degrees:
    // Left shoulder rotated forward (z = 0.1, x = 0.65), Right shoulder back (z = -0.2, x = 0.55)
    // dx = -0.1, dz = -0.3 -> atan2(-0.3, -0.1) = -108° -> negated for lefty = +108°
    const turnPast90LeftyBackswing = computeTransverseTurn({ x: 0.65, z: 0.1 }, { x: 0.55, z: -0.2 }, false);
    expect(Math.round(turnPast90LeftyBackswing)).toBe(108);
  });

  it('should detect Reverse Spine Angle when upper torso tilts toward target at P4', () => {
    const engine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    // Right-handed golfer tilting toward target at P4 (negative spine inclination)
    const rightyKinematics = {
      ...result.kinematics,
      P4_TOP: {
        ...result.kinematics.P4_TOP,
        spineInclination: -7.5
      }
    };
    const rightyFaults = detectSwingFaults(rightyKinematics, 'FACE_ON', true);
    const rsaRight = rightyFaults.find(f => f.id === 'REVERSE_SPINE');
    expect(rsaRight).toBeDefined();
    expect(rsaRight?.phaseDetected).toBe('P4_TOP');
    expect(rsaRight?.metricValue).toBe(7.5);

    // Left-handed golfer tilting toward target at P4 (positive spine inclination)
    const leftyKinematics = {
      ...result.kinematics,
      P4_TOP: {
        ...result.kinematics.P4_TOP,
        spineInclination: 8.0
      }
    };
    const leftyFaults = detectSwingFaults(leftyKinematics, 'FACE_ON', false);
    const rsaLeft = leftyFaults.find(f => f.id === 'REVERSE_SPINE');
    expect(rsaLeft).toBeDefined();
    expect(rsaLeft?.phaseDetected).toBe('P4_TOP');
    expect(rsaLeft?.metricValue).toBe(8.0);
  });

  it('should detect Sway in Backswing with correct sign for right-handed vs left-handed', () => {
    const engine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    // Right-handed: slides away from target (+X, positive lateral shift > 15%)
    const rightySwayKinematics = {
      ...result.kinematics,
      P4_TOP: {
        ...result.kinematics.P4_TOP,
        lateralPelvisShift: 18.5
      }
    };
    const rightyFaults = detectSwingFaults(rightySwayKinematics, 'FACE_ON', true);
    expect(rightyFaults.some(f => f.id === 'SWAY_BACKSWING')).toBe(true);

    // Right-handed: shifting toward target (-X) is NOT backswing sway
    const rightyNoSwayKinematics = {
      ...result.kinematics,
      P4_TOP: {
        ...result.kinematics.P4_TOP,
        lateralPelvisShift: -18.5
      }
    };
    const rightyNoFaults = detectSwingFaults(rightyNoSwayKinematics, 'FACE_ON', true);
    expect(rightyNoFaults.some(f => f.id === 'SWAY_BACKSWING')).toBe(false);

    // Left-handed: slides away from target (-X, negative lateral shift < -15%)
    const leftySwayKinematics = {
      ...result.kinematics,
      P4_TOP: {
        ...result.kinematics.P4_TOP,
        lateralPelvisShift: -19.0
      }
    };
    const leftyFaults = detectSwingFaults(leftySwayKinematics, 'FACE_ON', false);
    expect(leftyFaults.some(f => f.id === 'SWAY_BACKSWING')).toBe(true);
  });

  it('should compute 0° shoulder and pelvis turn at P1 address in Face-On, and realistic turn at P2/P4', () => {
    const engine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    const p1 = result.kinematics.P1_ADDRESS;
    expect(p1.shoulderTurn).toBe(0);
    expect(p1.pelvisTurn).toBe(0);
    expect(p1.xFactor).toBe(0);

    const p2 = result.kinematics.P2_TAKEAWAY;
    expect(p2.shoulderTurn).toBeGreaterThanOrEqual(10);
    expect(p2.shoulderTurn).toBeLessThanOrEqual(45);
    expect(p2.xFactor).toBeLessThan(50);

    const p4 = result.kinematics.P4_TOP;
    expect(p4.shoulderTurn).toBeGreaterThanOrEqual(70);
    expect(p4.shoulderTurn).toBeLessThanOrEqual(120);
    expect(p4.pelvisTurn).toBeGreaterThanOrEqual(30);
    expect(p4.pelvisTurn).toBeLessThanOrEqual(65);
    expect(p4.xFactor).toBeGreaterThan(20);
    expect(p4.xFactor).toBeLessThan(75);
  });

  it('should not detect Sway in Backswing when in DOWN_THE_LINE view', () => {
    const swayKinematics = {
      P4_TOP: {
        lateralPelvisShift: 45.0,
        lateralHeadSway: 30.0
      }
    } as any;
    const faults = detectSwingFaults(swayKinematics, 'DOWN_THE_LINE', true);
    expect(faults.some(f => f.id === 'SWAY_BACKSWING')).toBe(false);
  });

  it('should extract non-zero turn metrics for active frames and 0 only for actual address frame', () => {
    const frames = generate240FpsSwingSequence(480);
    const addressFrame = frames[40];
    const topFrame = frames[160];

    // Address frame should strictly be 0°
    const addressKinematics = extractPhaseKinematics(addressFrame, 'P1_ADDRESS', addressFrame, 'FACE_ON', true);
    expect(addressKinematics.shoulderTurn).toBe(0);
    expect(addressKinematics.pelvisTurn).toBe(0);
    expect(addressKinematics.xFactor).toBe(0);

    // Top frame with P4_TOP phase
    const topKinematics = extractPhaseKinematics(topFrame, 'P4_TOP', addressFrame, 'FACE_ON', true);
    expect(topKinematics.shoulderTurn).toBeGreaterThan(60);
    expect(topKinematics.pelvisTurn).toBeGreaterThan(25);
    expect(topKinematics.xFactor).toBeGreaterThan(20);

    // Active frame that is not address must NOT collapse to 0 even if phaseId is P1_ADDRESS
    const fallbackKinematics = extractPhaseKinematics(topFrame, 'P1_ADDRESS', addressFrame, 'FACE_ON', true);
    expect(fallbackKinematics.shoulderTurn).toBeGreaterThan(60);
    expect(fallbackKinematics.pelvisTurn).toBeGreaterThan(25);
    expect(fallbackKinematics.xFactor).toBeGreaterThan(20);
  });
});

