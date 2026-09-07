import { PhaseEngine, DEFAULT_HIP_HINGE_PHASE_CONFIG } from '../../../../src/core/motion/phases/phase-engine';

describe('PhaseEngine', () => {
  let engine: PhaseEngine;

  beforeEach(() => {
    engine = new PhaseEngine();
  });

  it('should start in READY phase', () => {
    expect(engine.currentPhase).toBe('READY');
    expect(engine.completedReps).toBe(0);
  });

  it('should complete a full rep cycle', () => {
    // READY -> DESCENT
    engine.processFrame(155, -20, 1, 100);
    expect(engine.currentPhase).toBe('DESCENT');

    // DESCENT -> ENDPOINT
    engine.processFrame(90, 0, 2, 200);
    expect(engine.currentPhase).toBe('ENDPOINT');

    // ENDPOINT -> RETURN
    engine.processFrame(95, 20, 3, 300);
    expect(engine.currentPhase).toBe('RETURN');

    // RETURN -> COMPLETE
    engine.processFrame(170, 5, 4, 400);
    expect(engine.currentPhase).toBe('COMPLETE');
    expect(engine.completedReps).toBe(1);

    // COMPLETE -> READY
    engine.processFrame(170, 5, 5, 500);
    expect(engine.currentPhase).toBe('READY');
    expect(engine.completedReps).toBe(1);
    
    expect(engine.transitions.length).toBe(5); // Including COMPLETE -> READY
  });

  it('should return COMPLETE before transitioning to READY', () => {
    engine.processFrame(155, -20, 1, 100); // DESCENT
    engine.processFrame(90, 0, 2, 200);    // ENDPOINT
    engine.processFrame(95, 20, 3, 300);   // RETURN
    
    const completePhase = engine.processFrame(170, 5, 4, 400);
    expect(completePhase).toBe('COMPLETE');
    expect(engine.completedReps).toBe(1);
    
    const readyPhase = engine.processFrame(170, 5, 5, 500);
    expect(readyPhase).toBe('READY');
    expect(engine.completedReps).toBe(1);
  });

  it('should recover from shallow descent back to READY', () => {
    // READY -> DESCENT
    engine.processFrame(155, -20, 1, 100);
    expect(engine.currentPhase).toBe('DESCENT');

    // Abort rep and stand back up
    engine.processFrame(170, 15, 2, 200);
    expect(engine.currentPhase).toBe('READY');
    expect(engine.completedReps).toBe(0);
  });

  it('should count rep even if stream ends at COMPLETE (edge case fix)', () => {
    engine.processFrame(155, -20, 1, 100); // DESCENT
    engine.processFrame(90, 0, 2, 200);    // ENDPOINT
    engine.processFrame(95, 20, 3, 300);   // RETURN
    engine.processFrame(170, 5, 4, 400);   // COMPLETE

    // Stream ends here — no more frames
    expect(engine.currentPhase).toBe('COMPLETE');
    expect(engine.completedReps).toBe(1); // Rep counted immediately at transition
  });

  it('should prevent oscillation using hysteresis', () => {
    // Just below 160 but with hysteresis margin 3, we need < 157
    engine.processFrame(158, -20, 1, 100);
    expect(engine.currentPhase).toBe('READY'); // Not deep enough yet due to hysteresis

    engine.processFrame(156, -20, 2, 200);
    expect(engine.currentPhase).toBe('DESCENT');
  });

  it('should ignore partial movement for endpoint', () => {
    engine.processFrame(150, -20, 1, 100);
    expect(engine.currentPhase).toBe('DESCENT');

    // Velocity drops, but angle is 170 which is not < (180 - 20)
    engine.processFrame(170, 0, 2, 200);
    expect(engine.currentPhase).toBe('READY'); // WAIT! 170 is > 165, so it triggers recovery to READY now.
  });

  it('should reset properly', () => {
    engine.processFrame(155, -20, 1, 100);
    expect(engine.currentPhase).toBe('DESCENT');
    engine.reset();
    expect(engine.currentPhase).toBe('READY');
    expect(engine.transitions.length).toBe(0);
  });
});
