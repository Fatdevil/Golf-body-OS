import { RotationPhaseEngine } from '../../../../src/core/motion/phases/rotation-phase-engine';

describe('RotationPhaseEngine', () => {
  let engine: RotationPhaseEngine;

  beforeEach(() => {
    engine = new RotationPhaseEngine();
  });

  it('starts in READY phase', () => {
    expect(engine.currentPhase).toBe('READY');
    expect(engine.isComplete).toBe(false);
  });

  it('transitions through full bilateral cycle to COMPLETE', () => {
    let frame = 1;
    let time = 1000;

    // 1. In READY, small movements do not trigger rotation
    expect(engine.processFrame(5, 4, frame++, (time += 33))).toBe('READY');

    // 2. Start turn LEFT
    expect(engine.processFrame(20, 25, frame++, (time += 33))).toBe('ROTATING_LEFT');

    // 3. Reach ENDPOINT LEFT (angle 45°, velocity drops to 3°/s)
    expect(engine.processFrame(45, 3, frame++, (time += 33))).toBe('ENDPOINT_LEFT');

    // 4. Start RETURN_FROM_LEFT (velocity negative -15°/s)
    expect(engine.processFrame(35, -15, frame++, (time += 33))).toBe('RETURN_FROM_LEFT');

    // 5. Reach CENTER_NEUTRAL (angle within center tolerance <= 12°)
    expect(engine.processFrame(8, -8, frame++, (time += 33))).toBe('CENTER_NEUTRAL');

    // 6. Start turn RIGHT (angle -20°, velocity -20°/s)
    expect(engine.processFrame(-20, -20, frame++, (time += 33))).toBe('ROTATING_RIGHT');

    // 7. Reach ENDPOINT RIGHT (angle -42°, velocity slows to -4°/s)
    expect(engine.processFrame(-42, -4, frame++, (time += 33))).toBe('ENDPOINT_RIGHT');

    // 8. Start RETURN_FROM_RIGHT (velocity positive +15°/s)
    expect(engine.processFrame(-30, 15, frame++, (time += 33))).toBe('RETURN_FROM_RIGHT');

    // 9. Reach COMPLETE (angle back to center <= 12°)
    expect(engine.processFrame(-5, 6, frame++, (time += 33))).toBe('COMPLETE');
    expect(engine.isComplete).toBe(true);
    expect(engine.transitions.length).toBe(8);
  });

  it('resets correctly', () => {
    engine.processFrame(25, 25, 1, 1000);
    expect(engine.currentPhase).toBe('ROTATING_LEFT');
    engine.reset();
    expect(engine.currentPhase).toBe('READY');
    expect(engine.transitions.length).toBe(0);
  });
});
