import { ClubTrackerEngine } from '../../../src/core/motion/club-tracker-engine';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';
import { LandmarkId } from '../../../src/core/types/landmark';
import { PoseFrame } from '../../../src/core/types/pose-frame';

describe('ClubTrackerEngine', () => {
  let tracker: ClubTrackerEngine;

  beforeEach(() => {
    tracker = new ClubTrackerEngine({ viewAngle: 'FACE_ON', isRightHanded: true });
  });

  it('should return null if no wrists are detected', () => {
    const emptyFrame: PoseFrame = {
      frameId: 1,
      timestampMs: 100,
      width: 640,
      height: 480,
      landmarks: [],
      model: 'MEDIAPIPE_POSE',
      modelVersion: '0.10.14'
    };

    expect(tracker.trackClub(emptyFrame)).toBeNull();
  });

  it('should track club at Address (P1) with valid grip and head coordinates', () => {
    const frames = generate240FpsSwingSequence(50, 'OPTIMAL', 'FACE_ON');
    const p1Frame = frames[40];

    const club = tracker.trackClub(p1Frame, 'P1_ADDRESS');

    expect(club).toBeDefined();
    expect(club?.grip.x).toBeCloseTo(0.50, 2);
    expect(club?.clubHead.y).toBe(0.90);
    expect(club?.shaftAngleDeg).toBe(48);
  });

  it('should detect Over-The-Top when user shaft is steeper than Tiger Ghost', () => {
    const frames = generate240FpsSwingSequence(300, 'OPTIMAL', 'FACE_ON');
    const p5Frame = frames[260];
    const ghostClub = p5Frame.club;

    const steepUserClub = {
      grip: { x: 0.52, y: 0.45, z: 0.10 },
      clubHead: { x: 0.55, y: 0.65, z: 0.05 },
      shaftAngleDeg: 58, // Steep shaft vs Tiger's shallower slot (35°)
      confidence: 0.95
    };

    const comparison = tracker.compareAgainstGhost(steepUserClub, ghostClub);

    expect(comparison.shaftPlaneDeviationDeg).toBeGreaterThan(12);
    expect(comparison.isOverTheTop).toBe(true);
  });

  it('should calculate forward shaft lean difference at Impact (P7)', () => {
    const frames = generate240FpsSwingSequence(300, 'OPTIMAL', 'FACE_ON');
    const p7Frame = frames[290];
    const ghostClub = p7Frame.club; // Tiger has 8.5° forward lean

    // User scooping with 1.5° forward lean
    const scoopingClub = {
      grip: { x: 0.50, y: 0.55, z: 0.0 },
      clubHead: { x: 0.50, y: 0.90, z: 0.0 },
      shaftAngleDeg: 52,
      forwardShaftLeanDeg: 1.5,
      confidence: 0.95
    };

    const comparison = tracker.compareAgainstGhost(scoopingClub, ghostClub);

    expect(comparison.forwardShaftLeanDiffDeg).toBeCloseTo(-7.0, 1); // User is 7° behind Tiger's shaft lean
  });
});
