import { ReadinessEngine } from '../../src/core/motion/readiness-engine';
import { PoseFrame } from '../../src/core/types/pose-frame';
import { LandmarkId } from '../../src/core/types/landmark';

describe('ReadinessEngine', () => {
  let engine: ReadinessEngine;

  beforeEach(() => {
    engine = new ReadinessEngine();
  });

  const createMockFrame = (timestampMs: number, lmsConfig: Partial<Record<LandmarkId, {x: number, y: number, z: number}>> = {}): PoseFrame => {
    const landmarks = Object.entries(lmsConfig).map(([idStr, coords]) => ({
      id: parseInt(idStr) as LandmarkId,
      x: coords.x,
      y: coords.y,
      z: coords.z,
      visibility: 1.0,
      presence: 1.0
    }));

    // Fill in minimal required landmarks to pass area/visibility checks if they aren't explicitly provided
    const required = [
      LandmarkId.NOSE, LandmarkId.LEFT_SHOULDER, LandmarkId.RIGHT_SHOULDER,
      LandmarkId.LEFT_HIP, LandmarkId.RIGHT_HIP, LandmarkId.LEFT_KNEE,
      LandmarkId.LEFT_ANKLE, LandmarkId.RIGHT_ANKLE, LandmarkId.LEFT_HEEL
    ];
    
    required.forEach((id, idx) => {
      if (!landmarks.find(l => l.id === id)) {
        landmarks.push({
          id,
          x: 0, // centered
          y: -0.4 + (idx * 0.1), // distribute to create some area
          z: 0,
          visibility: 1.0,
          presence: 1.0
        });
      }
    });

    return {
      frameId: 1,
      timestampMs,
      width: 1920,
      height: 1080,
      landmarks,
      model: 'test',
      modelVersion: '1.0'
    };
  };

  it('should transition through NOT_READY -> ADJUSTING -> READY_CANDIDATE -> READY', () => {
    // 1. No pose -> NOT_READY
    expect(engine.process({} as any).state).toBe('NOT_READY');

    // 2. Good pose -> READY_CANDIDATE
    const goodFrame = createMockFrame(100, {
      [LandmarkId.LEFT_SHOULDER]: { x: 0, y: -0.2, z: -0.2 },
      [LandmarkId.RIGHT_SHOULDER]: { x: 0, y: -0.2, z: 0.1 },
      [LandmarkId.LEFT_HIP]: { x: 0, y: 0.1, z: -0.2 },
      [LandmarkId.RIGHT_HIP]: { x: 0, y: 0.1, z: 0.1 }
    });
    let result = engine.process(goodFrame);
    expect(result.state).toBe('READY_CANDIDATE');
    expect(result.feedback).toBe('HOLD_STILL');

    // 3. 500ms later -> still READY_CANDIDATE
    result = engine.process({ ...goodFrame, timestampMs: 600 });
    expect(result.state).toBe('READY_CANDIDATE');

    // 4. 1100ms later -> READY
    result = engine.process({ ...goodFrame, timestampMs: 1200 });
    expect(result.state).toBe('READY');
    expect(result.feedback).toBeNull();
  });

  it('should reject wrong side orientation using Z depth', () => {
    // Right side closer to camera (Z is more negative)
    const badFrame = createMockFrame(100, {
      [LandmarkId.LEFT_SHOULDER]: { x: 0, y: -0.2, z: 0.1 },
      [LandmarkId.RIGHT_SHOULDER]: { x: 0, y: -0.2, z: -0.2 }, // Right is closer
      [LandmarkId.LEFT_HIP]: { x: 0, y: 0.1, z: 0.1 },
      [LandmarkId.RIGHT_HIP]: { x: 0, y: 0.1, z: -0.2 }
    });
    
    const result = engine.process(badFrame);
    expect(result.state).toBe('ADJUSTING');
    expect(result.feedback).toBe('TURN_LEFT_SIDE_TO_CAMERA');
  });

  it('should provide hysteresis grace period when dropping from READY', () => {
    const goodFrame = createMockFrame(100, {
      [LandmarkId.LEFT_SHOULDER]: { x: 0, y: -0.2, z: -0.2 },
      [LandmarkId.RIGHT_SHOULDER]: { x: 0, y: -0.2, z: 0.1 },
      [LandmarkId.LEFT_HIP]: { x: 0, y: 0.1, z: -0.2 },
      [LandmarkId.RIGHT_HIP]: { x: 0, y: 0.1, z: 0.1 }
    });
    
    // Get to READY
    engine.process(goodFrame);
    expect(engine.process({ ...goodFrame, timestampMs: 1200 }).state).toBe('READY');

    // Bad frame arrives at 1250ms (inside 200ms grace period)
    const badFrame = createMockFrame(1250, {
      [LandmarkId.LEFT_SHOULDER]: { x: 0, y: -0.2, z: 0.5 } // turn wrong way
    });
    
    let result = engine.process(badFrame);
    expect(result.state).toBe('READY'); // State is held!
    expect(result.feedback).toBe('HOLD_STILL');

    // Bad frame persists past grace period (1450ms > 1200 + 200)
    result = engine.process({ ...badFrame, timestampMs: 1450 });
    expect(result.state).toBe('ADJUSTING'); // Dropped!
    expect(result.feedback).toBe('TURN_LEFT_SIDE_TO_CAMERA');
  });

  it('should support FRONT view and require user to face camera', () => {
    engine.setRequiredView('FRONT');
    expect(engine.getRequiredView()).toBe('FRONT');

    // Turned sideways (small shoulderDx or large shoulderDz)
    const sidewaysFrame = createMockFrame(100, {
      [LandmarkId.LEFT_SHOULDER]: { x: 0, y: -0.2, z: -0.2 },
      [LandmarkId.RIGHT_SHOULDER]: { x: 0.05, y: -0.2, z: 0.2 },
      [LandmarkId.LEFT_HIP]: { x: 0, y: 0.1, z: -0.2 },
      [LandmarkId.RIGHT_HIP]: { x: 0.05, y: 0.1, z: 0.2 },
    });

    const result = engine.process(sidewaysFrame);
    expect(result.state).toBe('ADJUSTING');
    expect(result.feedback).toBe('FACE_CAMERA');

    // Square to camera
    const frontFrame = createMockFrame(200, {
      [LandmarkId.LEFT_SHOULDER]: { x: -0.2, y: -0.2, z: 0 },
      [LandmarkId.RIGHT_SHOULDER]: { x: 0.2, y: -0.2, z: 0 },
      [LandmarkId.LEFT_HIP]: { x: -0.15, y: 0.1, z: 0 },
      [LandmarkId.RIGHT_HIP]: { x: 0.15, y: 0.1, z: 0 },
    });

    const goodResult = engine.process(frontFrame);
    expect(goodResult.state).toBe('READY_CANDIDATE');
    expect(goodResult.feedback).toBe('HOLD_STILL');

    // Realistic front view with crossed arms (noisy Z depth ~0.20, moderate shoulder width ~0.11)
    const crossedArmsFrame = createMockFrame(300, {
      [LandmarkId.NOSE]: { x: 0, y: -0.3, z: -0.05 },
      [LandmarkId.LEFT_SHOULDER]: { x: 0.055, y: -0.2, z: 0.18 }, // forward arm
      [LandmarkId.RIGHT_SHOULDER]: { x: -0.055, y: -0.2, z: -0.04 },
      [LandmarkId.LEFT_HIP]: { x: 0.045, y: 0.0, z: 0.02 },
      [LandmarkId.RIGHT_HIP]: { x: -0.045, y: 0.0, z: -0.02 },
      [LandmarkId.LEFT_KNEE]: { x: 0.045, y: 0.25, z: 0 },
      [LandmarkId.RIGHT_KNEE]: { x: -0.045, y: 0.25, z: 0 },
    });
    const crossedResult = engine.process(crossedArmsFrame);
    expect(crossedResult.state).toBe('READY_CANDIDATE');
    expect(crossedResult.feedback).toBe('HOLD_STILL');
  });
});
