import { LandmarkId } from '../../../src/core/types/landmark';
import { PoseFrame } from '../../../src/core/types/pose-frame';
import { mirrorLandmark, mirrorPoseFrame } from '../../../src/core/coordinates/pose-mirror';

describe('Pose Mirror Utility', () => {
  it('should mirror landmark X coordinate across 0.5', () => {
    const lm = { id: LandmarkId.NOSE, x: 0.35, y: 0.20, z: 0.1 };
    const mirrored = mirrorLandmark(lm);
    expect(mirrored.id).toBe(LandmarkId.NOSE);
    expect(mirrored.x).toBeCloseTo(0.65);
    expect(mirrored.y).toBe(0.20);
    expect(mirrored.z).toBe(0.1);
  });

  it('should swap bilateral landmarks (left <-> right)', () => {
    const leftShoulder = { id: LandmarkId.LEFT_SHOULDER, x: 0.40, y: 0.30 };
    const rightShoulder = { id: LandmarkId.RIGHT_SHOULDER, x: 0.60, y: 0.30 };

    const mirroredLeft = mirrorLandmark(leftShoulder);
    const mirroredRight = mirrorLandmark(rightShoulder);

    expect(mirroredLeft.id).toBe(LandmarkId.RIGHT_SHOULDER);
    expect(mirroredLeft.x).toBeCloseTo(0.60);

    expect(mirroredRight.id).toBe(LandmarkId.LEFT_SHOULDER);
    expect(mirroredRight.x).toBeCloseTo(0.40);
  });

  it('should swap wrist, hip, knee, and foot landmarks in a full PoseFrame', () => {
    const frame: PoseFrame = {
      frameId: 1,
      timestampMs: 100,
      width: 640,
      height: 480,
      model: 'MEDIAPIPE_POSE',
      modelVersion: '0.10.14',
      landmarks: [
        { id: LandmarkId.NOSE, x: 0.50, y: 0.15 },
        { id: LandmarkId.LEFT_SHOULDER, x: 0.42, y: 0.30 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.58, y: 0.30 },
        { id: LandmarkId.LEFT_WRIST, x: 0.45, y: 0.60 },
        { id: LandmarkId.RIGHT_WRIST, x: 0.55, y: 0.60 },
        { id: LandmarkId.LEFT_HIP, x: 0.44, y: 0.50 },
        { id: LandmarkId.RIGHT_HIP, x: 0.56, y: 0.50 },
        { id: LandmarkId.LEFT_ANKLE, x: 0.43, y: 0.88 },
        { id: LandmarkId.RIGHT_ANKLE, x: 0.57, y: 0.88 },
      ],
    };

    const mirrored = mirrorPoseFrame(frame);

    expect(mirrored.frameId).toBe(1);
    expect(mirrored.landmarks.length).toBe(frame.landmarks.length);

    const mLS = mirrored.landmarks.find(l => l.id === LandmarkId.LEFT_SHOULDER);
    const mRS = mirrored.landmarks.find(l => l.id === LandmarkId.RIGHT_SHOULDER);
    expect(mLS?.x).toBeCloseTo(0.42); // 1 - 0.58
    expect(mRS?.x).toBeCloseTo(0.58); // 1 - 0.42

    const mLW = mirrored.landmarks.find(l => l.id === LandmarkId.LEFT_WRIST);
    const mRW = mirrored.landmarks.find(l => l.id === LandmarkId.RIGHT_WRIST);
    expect(mLW?.x).toBeCloseTo(0.45); // 1 - 0.55
    expect(mRW?.x).toBeCloseTo(0.55); // 1 - 0.45
  });

  it('should be an involution: mirror(mirror(frame)) equals original frame', () => {
    const frame: PoseFrame = {
      frameId: 1,
      timestampMs: 100,
      width: 640,
      height: 480,
      model: 'MEDIAPIPE_POSE',
      modelVersion: '0.10.14',
      landmarks: [
        { id: LandmarkId.NOSE, x: 0.52, y: 0.15 },
        { id: LandmarkId.LEFT_SHOULDER, x: 0.41, y: 0.28 },
        { id: LandmarkId.RIGHT_SHOULDER, x: 0.59, y: 0.29 },
        { id: LandmarkId.LEFT_ELBOW, x: 0.38, y: 0.45 },
        { id: LandmarkId.RIGHT_ELBOW, x: 0.62, y: 0.46 },
      ],
    };

    const doubleMirrored = mirrorPoseFrame(mirrorPoseFrame(frame));

    for (let i = 0; i < frame.landmarks.length; i++) {
      expect(doubleMirrored.landmarks[i].id).toBe(frame.landmarks[i].id);
      expect(doubleMirrored.landmarks[i].x).toBeCloseTo(frame.landmarks[i].x);
      expect(doubleMirrored.landmarks[i].y).toBeCloseTo(frame.landmarks[i].y);
    }
  });
});
