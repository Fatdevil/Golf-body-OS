import { LandmarkSmoother, VERSION } from '../../../../src/core/motion/filters/landmark-smoother';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';

describe('LandmarkSmoother', () => {
  it('has the correct version', () => {
    expect(VERSION).toBe('LANDMARK_SMOOTHER_V1');
  });

  it('preserves all original PoseFrame fields and returns landmarks as an array', () => {
    const smoother = new LandmarkSmoother();
    
    const frame: PoseFrame = {
      frameId: 100,
      timestampMs: 1500,
      width: 1920,
      height: 1080,
      model: 'blazepose',
      modelVersion: '1.0.0',
      landmarks: [
        { id: 0 as LandmarkId, x: 0.5, y: 0.5, z: 0.1, visibility: 0.9, presence: 0.95 }
      ]
    };

    const smoothed = smoother.smooth(frame);

    expect(smoothed.frameId).toBe(100);
    expect(smoothed.timestampMs).toBe(1500);
    expect(smoothed.width).toBe(1920);
    expect(smoothed.height).toBe(1080);
    expect(smoothed.model).toBe('blazepose');
    expect(smoothed.modelVersion).toBe('1.0.0');
    expect(Array.isArray(smoothed.landmarks)).toBe(true);
    expect(smoothed.landmarks.length).toBe(1);
    
    const lm = smoothed.landmarks[0];
    expect(lm.id).toBe(0);
    expect(lm.visibility).toBe(0.9);
    expect(lm.presence).toBe(0.95);
    expect(lm.x).toBeDefined();
    expect(lm.y).toBeDefined();
    expect(lm.z).toBeDefined();
  });

  it('uses filter keys based on landmark.id, not array index', () => {
    const smoother = new LandmarkSmoother();
    
    const frame1: PoseFrame = {
      frameId: 1, timestampMs: 1000, width: 640, height: 480, model: 'test', modelVersion: '1',
      landmarks: [
        { id: 11 as LandmarkId, x: 0.5, y: 0.5, z: 0.5 },
        { id: 12 as LandmarkId, x: 0.6, y: 0.6, z: 0.6 }
      ]
    };

    smoother.smooth(frame1);

    const frame2: PoseFrame = {
      frameId: 2, timestampMs: 1033, width: 640, height: 480, model: 'test', modelVersion: '1',
      landmarks: [
        { id: 12 as LandmarkId, x: 0.61, y: 0.61, z: 0.61 },
        { id: 11 as LandmarkId, x: 0.51, y: 0.51, z: 0.51 }
      ]
    };

    const smoothed2 = smoother.smooth(frame2);
    
    const lm12 = smoothed2.landmarks.find((l: Landmark) => l.id === 12);
    const lm11 = smoothed2.landmarks.find((l: Landmark) => l.id === 11);
    
    expect(lm12).toBeDefined();
    expect(lm11).toBeDefined();
    expect(lm12?.id).toBe(12);
    expect(lm11?.id).toBe(11);
  });

  it('uses more aggressive filtering for z than for x/y', () => {
    const smoother = new LandmarkSmoother({
      xyConfig: { minCutoff: 1.0, beta: 0.0, dCutoff: 1.0 },
      zConfig: { minCutoff: 0.1, beta: 0.0, dCutoff: 1.0 }
    });
    
    const frame1: PoseFrame = {
      frameId: 1, timestampMs: 1000, width: 640, height: 480, model: 'test', modelVersion: '1',
      landmarks: [{ id: 0 as LandmarkId, x: 0.5, y: 0.5, z: 0.5 }]
    };
    smoother.smooth(frame1);

    const frame2: PoseFrame = {
      frameId: 2, timestampMs: 1033, width: 640, height: 480, model: 'test', modelVersion: '1',
      landmarks: [{ id: 0 as LandmarkId, x: 0.6, y: 0.6, z: 0.6 }]
    };
    const smoothed2 = smoother.smooth(frame2);
    
    const lm = smoothed2.landmarks[0];
    
    // For x/y (minCutoff=1.0), it should respond faster than z (minCutoff=0.1)
    // Thus x will be closer to the new value (0.6) than z.
    const xDiff = Math.abs(0.6 - lm.x);
    const zDiff = Math.abs(0.6 - (lm.z ?? 0));
    
    expect(zDiff).toBeGreaterThan(xDiff);
  });
});
