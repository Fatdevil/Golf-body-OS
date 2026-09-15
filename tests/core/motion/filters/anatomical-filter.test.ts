import {
  sanitizeGolfPoseFrame,
  isArmLengthPlausible,
  isHandElevationPlausible,
  VERSION
} from '../../../../src/core/motion/filters/anatomical-filter';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';

describe('AnatomicalPlausibilityFilter', () => {
  it('has the correct version', () => {
    expect(VERSION).toBe('ANATOMICAL_FILTER_V1');
  });

  it('rejects hands placed below knee elevation (floor guard)', () => {
    const knee = { y: 0.65 };
    const validWrist = { y: 0.50 }; // At waist/chest
    const hallucinatedWrist = { y: 0.82 }; // Down by feet/shins

    expect(isHandElevationPlausible(validWrist, knee)).toBe(true);
    expect(isHandElevationPlausible(hallucinatedWrist, knee)).toBe(false);
  });

  it('rejects arm lengths that exceed 1.35x torso length', () => {
    const shoulder = { x: 0.5, y: 0.3 };
    const torsoLength = 0.2; // ~20% of image height
    const normalWrist = { x: 0.5, y: 0.5 }; // dist = 0.20 (1.0x torso)
    const stretchWrist = { x: 0.5, y: 0.65 }; // dist = 0.35 (1.75x torso)

    expect(isArmLengthPlausible(shoulder, normalWrist, torsoLength)).toBe(true);
    expect(isArmLengthPlausible(shoulder, stretchWrist, torsoLength)).toBe(false);
  });

  it('sanitizes a frame with hallucinated wrists at the feet and reconstructs them near the elbow', () => {
    // Mimic the exact scenario from the user screenshot:
    // Torso at y=0.30..0.48, knees at y=0.68, elbows at y=0.35, but wrists hallucinated at y=0.82
    const frame: PoseFrame = {
      frameId: 50,
      timestampMs: 1600,
      width: 1080,
      height: 1920,
      model: 'blazepose',
      modelVersion: '1.0.0',
      landmarks: [
        { id: LandmarkId.LEFT_SHOULDER, x: 0.45, y: 0.30, visibility: 0.95 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.55, y: 0.30, visibility: 0.95 },
        { id: LandmarkId.LEFT_ELBOW, x: 0.42, y: 0.38, visibility: 0.90 },
        { id: LandmarkId.RIGHT_ELBOW, x: 0.58, y: 0.38, visibility: 0.90 },
        // Hallucinated wrists at the feet:
        { id: LandmarkId.LEFT_WRIST, x: 0.44, y: 0.80, visibility: 0.80 },
        { id: LandmarkId.RIGHT_WRIST, x: 0.46, y: 0.85, visibility: 0.80 },
        { id: LandmarkId.LEFT_HIP, x: 0.46, y: 0.48, visibility: 0.95 },
        { id: LandmarkId.RIGHT_HIP, x: 0.54, y: 0.48, visibility: 0.95 },
        { id: LandmarkId.LEFT_KNEE, x: 0.45, y: 0.68, visibility: 0.95 },
        { id: LandmarkId.RIGHT_KNEE, x: 0.55, y: 0.68, visibility: 0.95 },
        { id: LandmarkId.LEFT_ANKLE, x: 0.44, y: 0.88, visibility: 0.95 },
        { id: LandmarkId.RIGHT_ANKLE, x: 0.56, y: 0.88, visibility: 0.95 },
      ]
    };

    const sanitized = sanitizeGolfPoseFrame(frame);

    const leftWrist = sanitized.landmarks.find(l => l.id === LandmarkId.LEFT_WRIST)!;
    const rightWrist = sanitized.landmarks.find(l => l.id === LandmarkId.RIGHT_WRIST)!;

    // Visibility must be flagged as untrusted
    expect(leftWrist.visibility).toBeLessThanOrEqual(0.10);
    expect(rightWrist.visibility).toBeLessThanOrEqual(0.10);

    // Reconstructed wrists must NOT be down by the feet/shins (y < 0.68 knee level)
    expect(leftWrist.y).toBeLessThan(0.68);
    expect(rightWrist.y).toBeLessThan(0.68);

    // Reconstructed wrists must be close to elbows (~0.45 * torsoLength = ~0.08)
    const leftElbow = sanitized.landmarks.find(l => l.id === LandmarkId.LEFT_ELBOW)!;
    expect(Math.abs(leftWrist.y - leftElbow.y)).toBeLessThan(0.15);
  });

  it('leaves anatomically sound golf poses completely untouched', () => {
    // Legitimate address pose
    const frame: PoseFrame = {
      frameId: 10,
      timestampMs: 300,
      width: 1080,
      height: 1920,
      model: 'blazepose',
      modelVersion: '1.0.0',
      landmarks: [
        { id: LandmarkId.LEFT_SHOULDER, x: 0.45, y: 0.30, visibility: 0.95 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.55, y: 0.30, visibility: 0.95 },
        { id: LandmarkId.LEFT_ELBOW, x: 0.44, y: 0.40, visibility: 0.90 },
        { id: LandmarkId.RIGHT_ELBOW, x: 0.56, y: 0.40, visibility: 0.90 },
        { id: LandmarkId.LEFT_WRIST, x: 0.49, y: 0.50, visibility: 0.92 },
        { id: LandmarkId.RIGHT_WRIST, x: 0.51, y: 0.50, visibility: 0.92 },
        { id: LandmarkId.LEFT_HIP, x: 0.46, y: 0.48, visibility: 0.95 },
        { id: LandmarkId.RIGHT_HIP, x: 0.54, y: 0.48, visibility: 0.95 },
        { id: LandmarkId.LEFT_KNEE, x: 0.45, y: 0.68, visibility: 0.95 },
        { id: LandmarkId.RIGHT_KNEE, x: 0.55, y: 0.68, visibility: 0.95 },
      ]
    };

    const sanitized = sanitizeGolfPoseFrame(frame);

    const leftWrist = sanitized.landmarks.find(l => l.id === LandmarkId.LEFT_WRIST)!;
    expect(leftWrist.x).toBe(0.49);
    expect(leftWrist.y).toBe(0.50);
    expect(leftWrist.visibility).toBe(0.92);
  });
});
