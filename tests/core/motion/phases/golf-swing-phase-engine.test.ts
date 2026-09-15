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

    expect(result.tempo.backswingDurationMs).toBeGreaterThan(700);
    expect(result.tempo.downswingDurationMs).toBeGreaterThan(200);
    expect(result.tempo.downswingDurationMs).toBeLessThan(result.tempo.backswingDurationMs);
    // Tempo ratio should be approximately 3.0:1 to 3.2:1 (Tour benchmark EXCELLENT)
    expect(result.tempo.tempoRatio).toBeGreaterThanOrEqual(2.8);
    expect(result.tempo.tempoRatio).toBeLessThanOrEqual(3.4);
    expect(result.tempo.rating).toBe('EXCELLENT');

    // Canonical checkpoints verification
    expect(result.phases.P1_ADDRESS.frameIndex).toBe(40);
    expect(result.phases.P4_TOP.frameIndex).toBe(230);
    expect(result.phases.P7_IMPACT.frameIndex).toBe(290);
    expect(result.phases.P10_FINISH.frameIndex).toBeGreaterThan(380);
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

  it('should detect all 10 P-positions on a Down-The-Line (DTL) 240 fps sequence', () => {
    const dtlEngine = new GolfSwingPhaseEngine({ viewAngle: 'DOWN_THE_LINE' });
    const dtlFrames = generate240FpsSwingSequence(480, 'OPTIMAL', 'DOWN_THE_LINE');
    const result = dtlEngine.analyzeSequence(dtlFrames);

    expect(result.viewAngle).toBe('DOWN_THE_LINE');
    expect(result.detectedFrameRate).toBe(240);
    expect(result.orderedEvents.length).toBe(10);

    // Spine inclination at address in DTL should show athletic forward bend (~30-38°)
    expect(result.kinematics.P1_ADDRESS.spineInclination).toBeGreaterThan(25);
    expect(result.kinematics.P1_ADDRESS.spineInclination).toBeLessThan(42);

    // Verify all 10 phases are temporally ordered
    for (let i = 0; i < result.orderedEvents.length - 1; i++) {
      expect(result.orderedEvents[i].frameIndex).toBeLessThan(result.orderedEvents[i + 1].frameIndex);
    }
  });

  it('should detect Early Extension fault in Down-The-Line (DTL) view', () => {
    const dtlEngine = new GolfSwingPhaseEngine({ viewAngle: 'DOWN_THE_LINE' });
    const eeFrames = generate240FpsSwingSequence(480, 'EARLY_EXTENSION', 'DOWN_THE_LINE');
    const result = dtlEngine.analyzeSequence(eeFrames);

    const eeFault = result.faults.find(f => f.id === 'EARLY_EXTENSION');
    expect(eeFault).toBeDefined();
    expect(eeFault?.phaseDetected).toBe('P7_IMPACT');
  });

  it('should detect phases on SWAY in Face-On view', () => {
    const foEngine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON' });
    const swayFrames = generate240FpsSwingSequence(480, 'SWAY', 'FACE_ON');
    const result = foEngine.analyzeSequence(swayFrames);
    expect(result.phases.P4_TOP.frameIndex).toBeLessThan(result.phases.P7_IMPACT.frameIndex);
    const swayFault = result.faults.find(f => f.id === 'SWAY_BACKSWING');
    expect(swayFault).toBeDefined();
    expect(swayFault?.phaseDetected).toBe('P4_TOP');
  });

  it('should ignore post-swing movements and accurately detect P1-P10 when golfer lowers club after finish (240 fps)', () => {
    const baseFrames = generate240FpsSwingSequence(450);
    const postSwingFrames = [...baseFrames];

    // Append 120 frames of post-swing motion (golfer lowers club to knees/ground and relaxes shoulders)
    const lastFrame = baseFrames[baseFrames.length - 1];
    for (let f = 450; f < 570; f++) {
      const prog = (f - 450) / 60; // 0 to 2 seconds
      const dropEase = Math.min(1, prog);
      const timestampMs = lastFrame.timestampMs + (f - 450) * (1000 / 240);

      // Clone landmarks with lowering hands and relaxing shoulders
      const updatedLandmarks = lastFrame.landmarks.map(l => {
        if (l.id === 15 || l.id === 16) { // Wrists drop from 0.19 to 0.70
          return { ...l, y: 0.19 + dropEase * 0.51, x: 0.35 + Math.sin(prog * Math.PI) * 0.10 };
        }
        if (l.id === 11 || l.id === 12) { // Shoulders relax from -95° to 0°
          const neutralTurn = -95 * (1 - dropEase);
          const rad = (neutralTurn * Math.PI) / 180;
          const xOffset = 0.09 * Math.cos(rad);
          return { ...l, x: l.id === 11 ? 0.50 - xOffset : 0.50 + xOffset };
        }
        return { ...l };
      });

      postSwingFrames.push({
        ...lastFrame,
        frameId: f,
        timestampMs,
        landmarks: updatedLandmarks
      });
    }

    const result = engine.analyzeSequence(postSwingFrames);

    // Anchors must lock onto the real swing, NOT the post-swing motion!
    expect(result.phases.P1_ADDRESS.frameIndex).toBe(40);
    expect(result.phases.P4_TOP.frameIndex).toBe(230);
    expect(result.phases.P7_IMPACT.frameIndex).toBe(290);
    expect(result.phases.P10_FINISH.frameIndex).toBeGreaterThanOrEqual(380);
    expect(result.phases.P10_FINISH.frameIndex).toBeLessThanOrEqual(450);
  });

  it('should accurately detect 30 fps swing sequence with post-swing relaxation', () => {
    // Subsample 240 fps to 30 fps (every 8th frame) up to 450 frames -> ~56 frames
    const highFpsFrames = generate240FpsSwingSequence(450);
    const frames30Fps: typeof highFpsFrames = [];
    for (let i = 0; i < highFpsFrames.length; i += 8) {
      frames30Fps.push({
        ...highFpsFrames[i],
        frameId: frames30Fps.length,
        timestampMs: (frames30Fps.length * 1000) / 30
      });
    }

    // Append 25 frames of post-swing (golfer lowers club and relaxes)
    const last30Frame = frames30Fps[frames30Fps.length - 1];
    for (let f = 0; f < 25; f++) {
      const idx = frames30Fps.length;
      const prog = Math.min(1, f / 15);
      const timestampMs = last30Frame.timestampMs + (f + 1) * (1000 / 30);
      const updatedLandmarks = last30Frame.landmarks.map(l => {
        if (l.id === 15 || l.id === 16) {
          return { ...l, y: 0.19 + prog * 0.50 };
        }
        return { ...l };
      });
      frames30Fps.push({
        ...last30Frame,
        frameId: idx,
        timestampMs,
        landmarks: updatedLandmarks
      });
    }

    const result30 = engine.analyzeSequence(frames30Fps);

    expect(result30.detectedFrameRate).toBe(30);
    // P1 address should be near frame 5 (40 / 8)
    expect(result30.phases.P1_ADDRESS.frameIndex).toBeLessThanOrEqual(10);
    // P4 top should be near frame 28-30 (230 / 8 = 28.75)
    expect(result30.phases.P4_TOP.frameIndex).toBeGreaterThanOrEqual(25);
    expect(result30.phases.P4_TOP.frameIndex).toBeLessThanOrEqual(32);
    // P7 impact should be near frame 36 (290 / 8 = 36.25)
    expect(result30.phases.P7_IMPACT.frameIndex).toBeGreaterThanOrEqual(34);
    expect(result30.phases.P7_IMPACT.frameIndex).toBeLessThanOrEqual(40);
    // P10 finish should be before post-swing starts (before frame 56)
    expect(result30.phases.P10_FINISH.frameIndex).toBeLessThanOrEqual(56);
  });

  it('should accurately detect all 10 P-phases on a LEFT-HANDED golfer', () => {
    const { mirrorPoseFrame } = require('../../../../src/core/coordinates/pose-mirror');
    const rightyFrames = generate240FpsSwingSequence(480);
    const leftyFrames = rightyFrames.map(mirrorPoseFrame);

    const leftyEngine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON', isRightHanded: false });
    const result = leftyEngine.analyzeSequence(leftyFrames);

    expect(result.phases.P1_ADDRESS.frameIndex).toBe(40);
    expect(result.phases.P4_TOP.frameIndex).toBe(230);
    expect(result.phases.P7_IMPACT.frameIndex).toBe(290);
    expect(result.phases.P10_FINISH.frameIndex).toBeGreaterThanOrEqual(380);
  });

  it('should accurately detect phases in a slow-motion video (e.g. 240 fps played at 30 fps)', () => {
    const { mirrorPoseFrame } = require('../../../../src/core/coordinates/pose-mirror');
    // Simulate iPhone slow-motion: 240 fps motion saved into 30 fps video container
    // So 480 frames takes 16 seconds (timestampMs = frameIndex * 1000 / 30)
    const rawFrames = generate240FpsSwingSequence(480).map(mirrorPoseFrame);
    const slowMoFrames = rawFrames.map((f, idx) => ({
      ...f,
      frameId: idx,
      timestampMs: (idx * 1000) / 30 // Encoded as 30 fps video playback!
    }));

    const slowMoEngine = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON', isRightHanded: false });
    const result = slowMoEngine.analyzeSequence(slowMoFrames);

    // Should still detect P1=40, P4=230, P7=290, P10>=380!
    expect(result.phases.P1_ADDRESS.frameIndex).toBe(40);
    expect(result.phases.P4_TOP.frameIndex).toBe(230);
    expect(result.phases.P7_IMPACT.frameIndex).toBe(290);
    expect(result.phases.P10_FINISH.frameIndex).toBeGreaterThanOrEqual(380);
  });

  it('should auto-detect left-handed golfer even if isRightHanded option was left as true', () => {
    const { mirrorPoseFrame } = require('../../../../src/core/coordinates/pose-mirror');
    const rightyFrames = generate240FpsSwingSequence(480);
    const leftyFrames = rightyFrames.map(mirrorPoseFrame);

    // User left isRightHanded as true, but video is left-handed!
    const engineDefault = new GolfSwingPhaseEngine({ viewAngle: 'FACE_ON', isRightHanded: true });
    const result = engineDefault.analyzeSequence(leftyFrames);

    expect(result.phases.P1_ADDRESS.frameIndex).toBe(40);
    expect(result.phases.P4_TOP.frameIndex).toBe(230);
    expect(result.phases.P7_IMPACT.frameIndex).toBe(290);
    expect(result.phases.P10_FINISH.frameIndex).toBeGreaterThanOrEqual(380);
    expect(result.isRightHanded).toBe(false);
  });

  it('should respect manual isRightHanded setting when autoDetectHandedness is false', () => {
    const { mirrorPoseFrame } = require('../../../../src/core/coordinates/pose-mirror');
    const rightyFrames = generate240FpsSwingSequence(480);
    const leftyFrames = rightyFrames.map(mirrorPoseFrame);

    // User explicitly forced isRightHanded: true and disabled auto-detection
    const forcedEngine = new GolfSwingPhaseEngine({
      viewAngle: 'FACE_ON',
      isRightHanded: true,
      autoDetectHandedness: false
    });
    const result = forcedEngine.analyzeSequence(leftyFrames);

    // Should maintain isRightHanded as true without auto-flipping
    expect(result.isRightHanded).toBe(true);
  });

  it('should not be tricked into picking finish as P7 when MediaPipe hallucinates wrists at the feet', () => {
    const rawFrames = generate240FpsSwingSequence(480);
    // Corrupt finish frames (frames 370..420) so wrists are hallucinated down at the feet (y = 0.85)
    const corruptedFrames = rawFrames.map((frame, idx) => {
      if (idx >= 370 && idx <= 420) {
        return {
          ...frame,
          landmarks: frame.landmarks.map(lm => {
            if (lm.id === 15 || lm.id === 16) { // LEFT_WRIST or RIGHT_WRIST
              return { ...lm, y: 0.85, visibility: 0.75 };
            }
            return lm;
          })
        };
      }
      return frame;
    });

    const result = engine.analyzeSequence(corruptedFrames);

    // Impact must remain at true impact (frame 290), NOT in the corrupted finish (370..420)!
    expect(result.phases.P7_IMPACT.frameIndex).toBe(290);
    expect(result.phases.P10_FINISH.frameIndex).toBeGreaterThanOrEqual(380);
  });

  it('should accurately separate P6 (Delivery) and P7 (Impact) when hands bottom out vertically at trail thigh before crossing address line', () => {
    const baseFrames = generate240FpsSwingSequence(480);
    // Modify frames so hands reach their lowest vertical elevation at frame 270 (trail thigh, x = 0.58, y = 0.56)
    // and then travel horizontally forward to cross the address position (x = 0.49, y = 0.54) at frame 290.
    const modifiedFrames = baseFrames.map((frame, idx) => {
      if (idx >= 265 && idx <= 275) {
        return {
          ...frame,
          landmarks: frame.landmarks.map(lm => {
            if (lm.id === 15 || lm.id === 16) {
              return { ...lm, x: 0.58, y: 0.56 };
            }
            return lm;
          })
        };
      }
      return frame;
    });

    const result = engine.analyzeSequence(modifiedFrames);

    // Delivery P6 should precede Impact P7
    expect(result.phases.P6_DELIVERY.frameIndex).toBeLessThan(result.phases.P7_IMPACT.frameIndex);

    // Impact P7 should NOT get stuck at vertical bottom frame 270 (P6), but accurately lock onto the lateral address crossing at impact (~frame 290)!
    expect(result.phases.P7_IMPACT.frameIndex).toBeGreaterThanOrEqual(288);
    expect(result.phases.P7_IMPACT.frameIndex).toBeLessThanOrEqual(291);
  });

  it('should disqualify follow-through frames with high closed/open shoulder rotation (-75 deg) from being chosen as P7', () => {
    const baseFrames = generate240FpsSwingSequence(480);
    // Simulate a scenario where follow-through frame ~350 has hands crossing address x,
    // but shoulders are turned to -75 deg (deep follow-through).
    // Impact must NOT be placed at frame 350.
    const modifiedFrames = baseFrames.map((frame, idx) => {
      if (idx === 350) {
        return {
          ...frame,
          landmarks: frame.landmarks.map(lm => {
            // Address wrist x is ~0.49
            if (lm.id === 15 || lm.id === 16) {
              return { ...lm, x: 0.49, y: 0.54 };
            }
            return lm;
          })
        };
      }
      return frame;
    });

    const result = engine.analyzeSequence(modifiedFrames);
    expect(result.phases.P7_IMPACT.frameIndex).not.toBe(350);
    expect(result.phases.P7_IMPACT.frameIndex).toBe(290);
  });

  it('should enforce that downswing search window does not drift beyond 0.60 * backswingSpan', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);
    const p1 = result.phases.P1_ADDRESS.frameIndex;
    const p4 = result.phases.P4_TOP.frameIndex;
    const p7 = result.phases.P7_IMPACT.frameIndex;

    const backswingSpan = p4 - p1;
    const downswingSpan = p7 - p4;

    // Downswing span must be strictly less than or equal to 60% of backswing span
    expect(downswingSpan).toBeLessThanOrEqual(Math.round(backswingSpan * 0.60));
  });

  it('should automatically infer 8x slow-mo factor on 240fps video exported at 30fps (>9.0s swing)', () => {
    const baseFrames = generate240FpsSwingSequence(480);
    // Simulate 30 fps playback of 240 fps recording (8x slow motion)
    // 480 frames at 30 fps = 16 seconds total, swing span (P10 - P1) ~ 12.7 seconds
    const slowMoFrames = baseFrames.map((frame, idx) => ({
      ...frame,
      timestampMs: Math.round(idx * (1000 / 30) * 10) / 10
    }));

    // Analyze with default engine (slowMotionFactor = 1.0)
    const result = engine.analyzeSequence(slowMoFrames);

    // Total swing duration in stretched time is (p10 - p1) / 30fps ~ 12.7s > 9.0s
    expect(result.phases.P10_FINISH.timestampMs - result.phases.P1_ADDRESS.timestampMs).toBeGreaterThan(9000);

    // Engine should have automatically inferred slowMoFactor = 8.0
    expect(result.slowMotionFactor).toBe(8.0);
    // and scaled tempo durations down to physiological milliseconds (~790ms backswing, ~250ms downswing)
    expect(result.tempo.backswingDurationMs).toBeLessThan(1000);
    expect(result.tempo.backswingDurationMs).toBeGreaterThan(600);
    expect(result.tempo.downswingDurationMs).toBeLessThan(350);
    expect(result.tempo.downswingDurationMs).toBeGreaterThan(180);
    expect(result.tempo.tempoRatio).toBeGreaterThanOrEqual(2.8);
  });

  it('should automatically infer 4x slow-mo factor on 120fps video exported at 30fps (4.5s - 9.0s swing)', () => {
    const baseFrames = generate240FpsSwingSequence(480);
    // Subsample by 2 to simulate 120 fps recording (240 frames), then playback at 30 fps (4x slow motion)
    // 240 frames at 30 fps = 8 seconds total, swing span (P10 - P1) ~ 6.3 seconds
    const slowMo120Frames = baseFrames
      .filter((_, idx) => idx % 2 === 0)
      .map((frame, newIdx) => ({
        ...frame,
        timestampMs: Math.round(newIdx * (1000 / 30) * 10) / 10
      }));

    // Analyze with default engine (slowMotionFactor = 1.0)
    const result = engine.analyzeSequence(slowMo120Frames);

    const swingDurationMs = result.phases.P10_FINISH.timestampMs - result.phases.P1_ADDRESS.timestampMs;
    expect(swingDurationMs).toBeGreaterThan(4500);
    expect(swingDurationMs).toBeLessThan(9000);

    // Engine should have automatically inferred slowMoFactor = 4.0
    expect(result.slowMotionFactor).toBe(4.0);
    // and scaled tempo durations down to physiological milliseconds
    expect(result.tempo.backswingDurationMs).toBeLessThan(1000);
    expect(result.tempo.backswingDurationMs).toBeGreaterThan(600);
    expect(result.tempo.downswingDurationMs).toBeLessThan(350);
    expect(result.tempo.downswingDurationMs).toBeGreaterThan(180);
    expect(result.tempo.tempoRatio).toBeGreaterThanOrEqual(2.8);
  });

  it('should disqualify frames with backswing shoulder turn (+70 deg) from being chosen as P6 Delivery', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);
    const p6Frame = frames[result.phases.P6_DELIVERY.frameIndex];
    const ls = p6Frame.landmarks.find(l => l.id === 11);
    const rs = p6Frame.landmarks.find(l => l.id === 12);
    expect(ls).toBeDefined();
    expect(rs).toBeDefined();

    // In Delivery, shoulders must be unwinding towards square (never +70 deg like backswing top!)
    const p6Turn = result.kinematics.P6_DELIVERY.shoulderTurn;
    expect(p6Turn).toBeLessThan(35);
  });

  it('should never produce an inverted tempo (ratio < 1.0) under any circumstances', () => {
    const frames = generate240FpsSwingSequence(480);
    const result = engine.analyzeSequence(frames);

    expect(result.tempo.tempoRatio).toBeGreaterThanOrEqual(1.4);
    expect(result.tempo.backswingDurationMs).toBeGreaterThan(result.tempo.downswingDurationMs);
  });

  it('should detect authentic swing phases on Face-On video where right shoulder is at smaller X than left shoulder', () => {
    // In real MediaPipe camera captures facing camera, right shoulder (landmark 12) is at smaller X (viewer left)
    // than left shoulder (landmark 11) (viewer right).
    const baseFrames = generate240FpsSwingSequence(480);
    const cameraFrames = baseFrames.map(f => ({
      ...f,
      landmarks: f.landmarks.map(l => ({
        ...l,
        x: 1.0 - l.x, // Mirror X horizontally so rs.x < ls.x
      }))
    }));

    const result = engine.analyzeSequence(cameraFrames);
    expect(result.phases.P1_ADDRESS).toBeDefined();
    expect(result.phases.P4_TOP).toBeDefined();
    expect(result.phases.P7_IMPACT).toBeDefined();
    expect(result.phases.P10_FINISH).toBeDefined();

    expect(result.phases.P1_ADDRESS.frameIndex).toBeLessThan(result.phases.P4_TOP.frameIndex);
    expect(result.phases.P4_TOP.frameIndex).toBeLessThan(result.phases.P7_IMPACT.frameIndex);
    expect(result.phases.P7_IMPACT.frameIndex).toBeLessThan(result.phases.P10_FINISH.frameIndex);

    // Fallback should NOT have been triggered!
    expect(result.phases.P1_ADDRESS.confidence).toBeGreaterThan(0.9);
    expect(result.phases.P4_TOP.confidence).toBeGreaterThan(0.9);
    expect(result.phases.P7_IMPACT.confidence).toBeGreaterThan(0.9);
    expect(result.tempo.tempoRatio).toBeGreaterThanOrEqual(2.0);
  });
});


