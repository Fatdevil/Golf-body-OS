import { LiveRotationCoachingEngine } from '../../../src/core/coaching/live-rotation-coaching-engine';
import { AudioCoachService } from '../../../src/core/coaching/audio-coach';
import { LandmarkId } from '../../../src/core/types/landmark';
import { PoseFrame } from '../../../src/core/types/pose-frame';

describe('LiveRotationCoachingEngine', () => {
  let audioCoach: AudioCoachService;
  let engine: LiveRotationCoachingEngine;
  let spokenKeys: string[];
  let completeCalled: boolean;

  beforeEach(() => {
    (global as any).window = {
      speechSynthesis: {
        cancel: jest.fn(),
        speak: jest.fn(),
        getVoices: jest.fn().mockReturnValue([]),
      },
    };
    (global as any).SpeechSynthesisUtterance = jest.fn();

    audioCoach = new AudioCoachService();
    spokenKeys = [];
    completeCalled = false;

    audioCoach.onSpoken((entry) => {
      spokenKeys.push(entry.key);
    });

    engine = new LiveRotationCoachingEngine(audioCoach, {
      onComplete: () => {
        completeCalled = true;
      },
    });
  });

  function createFrame(timeMs: number, shoulderZDiff: number, pelvicZDiff: number): PoseFrame {
    const lms: any[] = [];
    for (let i = 0; i < 33; i++) {
      lms.push({ id: i, x: 0, y: 0, z: 0, visibility: 0.9 });
    }

    // Left shoulder
    lms[LandmarkId.LEFT_SHOULDER] = {
      id: LandmarkId.LEFT_SHOULDER,
      x: -0.2,
      y: 0.3,
      z: shoulderZDiff / 2,
      visibility: 0.9,
    };
    // Right shoulder
    lms[LandmarkId.RIGHT_SHOULDER] = {
      id: LandmarkId.RIGHT_SHOULDER,
      x: 0.2,
      y: 0.3,
      z: -shoulderZDiff / 2,
      visibility: 0.9,
    };
    // Left hip
    lms[LandmarkId.LEFT_HIP] = {
      id: LandmarkId.LEFT_HIP,
      x: -0.15,
      y: -0.1,
      z: pelvicZDiff / 2,
      visibility: 0.9,
    };
    // Right hip
    lms[LandmarkId.RIGHT_HIP] = {
      id: LandmarkId.RIGHT_HIP,
      x: 0.15,
      y: -0.1,
      z: -pelvicZDiff / 2,
      visibility: 0.9,
    };

    return {
      frameId: Math.floor(timeMs / 33),
      timestampMs: timeMs,
      width: 640,
      height: 480,
      landmarks: lms,
      model: 'test',
      modelVersion: '1.0',
    };
  }

  it('progresses through left turn, center, right turn, and calls onComplete', () => {
    // 1. Neutral frame (0°)
    engine.processFrame(createFrame(1000, 0, 0));
    engine.processFrame(createFrame(1033, 0, 0));

    // 2. Turning left (dz = 0.25 -> ~32° isolated)
    engine.processFrame(createFrame(1100, 0.25, 0));
    engine.processFrame(createFrame(1133, 0.26, 0)); 
    engine.processFrame(createFrame(1166, 0.26, 0)); // Held still at endpoint left!
    expect(spokenKeys).toContain('HOLD_POSITION');

    // 3. Returning from left
    engine.processFrame(createFrame(1300, 0.15, 0));
    expect(spokenKeys).toContain('RETURN_CENTER');

    // 4. Center neutral -> cues rotate right
    engine.processFrame(createFrame(1400, 0.02, 0));
    expect(spokenKeys).toContain('ROTATE_RIGHT');

    // 5. Turning right (dz = -0.25)
    engine.processFrame(createFrame(1600, -0.25, 0));
    engine.processFrame(createFrame(1633, -0.26, 0));
    engine.processFrame(createFrame(1666, -0.26, 0)); // Held still at endpoint right!

    // 6. Return from right
    engine.processFrame(createFrame(1800, -0.15, 0));

    // 7. Reached center -> COMPLETE!
    engine.processFrame(createFrame(2000, 0.01, 0));
    expect(spokenKeys).toContain('ROTATION_DONE');
    expect(completeCalled).toBe(true);
  });
});
