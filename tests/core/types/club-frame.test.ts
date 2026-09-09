import { ClubState, mirrorClubState } from '../../../src/core/types/club-frame';
import { mirrorPoseFrame } from '../../../src/core/coordinates/pose-mirror';
import { generateTigerClubState, generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';

describe('ClubFrame & Tiger 2000 3D Club Mechanics', () => {
  it('should generate valid ClubState with address coordinates at P1', () => {
    const club = generateTigerClubState(40, 0.50, 0.55, 0.0, 'FACE_ON');

    expect(club.grip.x).toBe(0.50);
    expect(club.grip.y).toBe(0.55);
    expect(club.clubHead.x).toBe(0.50);
    expect(club.clubHead.y).toBe(0.90);
    expect(club.forwardShaftLeanDeg).toBe(3.0);
    expect(club.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should model shaft horizontal at P4 Top of Backswing', () => {
    const club = generateTigerClubState(230, 0.72, 0.23, 0.20, 'FACE_ON');

    expect(club.shaftAngleDeg).toBe(0); // Shaft is parallel to ground
    expect(club.clubHead.y).toBeLessThan(club.grip.y); // Clubhead is high
  });

  it('should model Tiger tour-standard forward shaft lean (8.5°) at P7 Impact', () => {
    const club = generateTigerClubState(290, 0.48, 0.55, 0.0, 'FACE_ON');

    expect(club.forwardShaftLeanDeg).toBeCloseTo(8.5, 1);
    expect(club.clubHead.y).toBe(0.90); // Impact at the ball
  });

  it('should mirror ClubState horizontally for left-handed golfers', () => {
    const rightyClub: ClubState = {
      grip: { x: 0.52, y: 0.55, z: 0.10 },
      clubHead: { x: 0.70, y: 0.25, z: 0.20 },
      shaftAngleDeg: 15,
      faceAngleDeg: -8,
      forwardShaftLeanDeg: 8.5,
      confidence: 0.98
    };

    const leftyClub = mirrorClubState(rightyClub);

    expect(leftyClub.grip.x).toBeCloseTo(0.48, 4);
    expect(leftyClub.grip.y).toBe(0.55);
    expect(leftyClub.grip.z).toBeCloseTo(-0.10, 4);

    expect(leftyClub.clubHead.x).toBeCloseTo(0.30, 4);
    expect(leftyClub.clubHead.y).toBe(0.25);
    expect(leftyClub.clubHead.z).toBeCloseTo(-0.20, 4);

    expect(leftyClub.shaftAngleDeg).toBe(15);
    expect(leftyClub.faceAngleDeg).toBe(8); // Face angle inverted
    expect(leftyClub.forwardShaftLeanDeg).toBe(-8.5); // Lean inverted
  });

  it('should seamlessly mirror PoseFrame with attached club', () => {
    const frames = generate240FpsSwingSequence(50, 'OPTIMAL', 'FACE_ON');
    const rightyFrame = frames[40]; // P1 Address
    expect(rightyFrame.club).toBeDefined();

    const mirroredFrame = mirrorPoseFrame(rightyFrame);

    expect(mirroredFrame.club).toBeDefined();
    expect(mirroredFrame.club?.grip.x).toBeCloseTo(1 - rightyFrame.club!.grip.x, 4);
    expect(mirroredFrame.club?.clubHead.x).toBeCloseTo(1 - rightyFrame.club!.clubHead.x, 4);
  });

  it('should maintain rigid constant physical shaft length across all 480 frames in FACE_ON and DTL', () => {
    const foFrames = generate240FpsSwingSequence(480, 'OPTIMAL', 'FACE_ON');
    for (let i = 0; i < foFrames.length; i++) {
      const club = foFrames[i].club!;
      expect(club).toBeDefined();
      const dx = club.clubHead.x - club.grip.x;
      const dy = club.clubHead.y - club.grip.y;
      const dz = (club.clubHead.z ?? 0) - (club.grip.z ?? 0);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Face-On shaft length is strictly 0.35
      expect(len).toBeCloseTo(0.35, 2);
    }

    const dtlFrames = generate240FpsSwingSequence(480, 'OPTIMAL', 'DOWN_THE_LINE');
    for (let i = 0; i < dtlFrames.length; i++) {
      const club = dtlFrames[i].club!;
      expect(club).toBeDefined();
      const dx = club.clubHead.x - club.grip.x;
      const dy = club.clubHead.y - club.grip.y;
      const dz = (club.clubHead.z ?? 0) - (club.grip.z ?? 0);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // DTL shaft length is strictly 0.36
      expect(len).toBeCloseTo(0.36, 2);
    }
  });
});
