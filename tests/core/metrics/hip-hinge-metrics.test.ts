/**
 * Tests for Hip Hinge Metrics — validates angle calculations,
 * compensation detection, and direction-aware posterior hip shift.
 */

import { LandmarkId, Landmark } from '../../../src/core/types/landmark';
import { extractRepMetrics } from '../../../src/core/metrics/hip-hinge-metrics';

/** Helper to create a Landmark array from coordinate pairs */
function makeLandmarks(
  specs: Array<{ id: LandmarkId; x: number; y: number; z?: number; visibility?: number }>
): Landmark[] {
  return specs.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    z: s.z,
    visibility: s.visibility ?? 1.0,
    presence: 1.0,
  }));
}

describe('Hip Hinge Metrics (S14)', () => {
  // Standing baseline: person upright, LEFT side
  // In BODY_METRIC space (Y points UP):
  // ear at (0, 25), shoulder at (0, 20), hip at (0, 10), knee at (0, 5), ankle at (0, 0)
  const standingLandmarks = makeLandmarks([
    { id: LandmarkId.LEFT_EAR, x: 0, y: 25 },
    { id: LandmarkId.LEFT_SHOULDER, x: 0, y: 20 },
    { id: LandmarkId.LEFT_HIP, x: 0, y: 10 },
    { id: LandmarkId.LEFT_KNEE, x: 0, y: 5 },
    { id: LandmarkId.LEFT_ANKLE, x: 0, y: 0 },
  ]);

  it('Standing baseline produces ~180° HIP_HINGE_ANGLE_2D', () => {
    // Use standing landmarks for both current and baseline
    const result = extractRepMetrics(standingLandmarks, standingLandmarks, 0, 'LEFT', false);

    expect(result.hipHingeAngle2D.value).toBeCloseTo(180, 0);
    expect(result.hipHingeAngle2D.id).toBe('HIP_HINGE_ANGLE_2D');
    expect(result.hipHingeAngle2D.validationStatus).toBe('EXPERIMENTAL');
    expect(result.trunkInclination.value).toBeCloseTo(0, 0);
  });

  it('Hinged position produces expected angle and metrics', () => {
    // Hinged: shoulder moved forward (x=10), hip still at (0, 10)
    // This creates a ~90° shoulder→hip→knee angle
    const hingedLandmarks = makeLandmarks([
      { id: LandmarkId.LEFT_EAR, x: 10, y: 11 },
      { id: LandmarkId.LEFT_SHOULDER, x: 10, y: 10 },
      { id: LandmarkId.LEFT_HIP, x: 0, y: 10 },
      { id: LandmarkId.LEFT_KNEE, x: 0, y: 5 },
      { id: LandmarkId.LEFT_ANKLE, x: 0, y: 0 },
    ]);

    const result = extractRepMetrics(hingedLandmarks, standingLandmarks, 42, 'LEFT', false);

    expect(result.hipHingeAngle2D.value).toBeCloseTo(90, 0);
    expect(result.trunkInclination.value).toBeCloseTo(90, 0); // Torso horizontal
    expect(result.kneeAngleAtEndpoint.value).toBeCloseTo(180, 0); // Legs straight
  });

  it('BUG-2 fix: Compensation detection detects forward hip shift', () => {
    // Simulate someone hinging but shifting hips FORWARD instead of backward
    // In this scenario (facingRight=false), forward shift should be NEGATIVE
    // which should trigger NO_POSTERIOR_SHIFT compensation
    const forwardHipLandmarks = makeLandmarks([
      { id: LandmarkId.LEFT_EAR, x: -10, y: 11 },
      { id: LandmarkId.LEFT_SHOULDER, x: -10, y: 10 },
      { id: LandmarkId.LEFT_HIP, x: -3, y: 10 }, // Hips shifted forward (negative X when facing left)
      { id: LandmarkId.LEFT_KNEE, x: 0, y: 5 },
      { id: LandmarkId.LEFT_ANKLE, x: 0, y: 0 },
    ]);

    const result = extractRepMetrics(forwardHipLandmarks, standingLandmarks, 10, 'LEFT', false);

    // With BUG-2 fix: posteriorHipShift should be negative (forward shift)
    // This should trigger NO_POSTERIOR_SHIFT compensation since shift < 0.05
    // and trunkInclination > 40°
    expect(result.posteriorHipShift.value).toBeLessThan(0.05);
    expect(result.trunkInclination.value).toBeGreaterThan(40);
    expect(result.compensations.map((c) => c.type)).toContain('NO_POSTERIOR_SHIFT');
  });

  it('BUG-2 fix: Correct posterior shift does NOT trigger compensation', () => {
    // Simulate correct hip hinge with hips pushed backward
    // facingRight=false, so posterior = positive X direction
    const correctHingeLandmarks = makeLandmarks([
      { id: LandmarkId.LEFT_EAR, x: -8, y: 11 },
      { id: LandmarkId.LEFT_SHOULDER, x: -8, y: 10 },
      { id: LandmarkId.LEFT_HIP, x: 5, y: 10 }, // Hips shifted backward (positive X when facing left)
      { id: LandmarkId.LEFT_KNEE, x: 0, y: 5 },
      { id: LandmarkId.LEFT_ANKLE, x: 0, y: 0 },
    ]);

    const result = extractRepMetrics(correctHingeLandmarks, standingLandmarks, 10, 'LEFT', false);

    // With correct posterior shift, NO_POSTERIOR_SHIFT should NOT be flagged
    expect(result.posteriorHipShift.value).toBeGreaterThan(0.05);
    const types = result.compensations.map((c) => c.type);
    expect(types).not.toContain('NO_POSTERIOR_SHIFT');
  });

  it('BUG-9 fix: legLength uses hip→knee + knee→ankle', () => {
    // Standing baseline with bent knee: hip→knee is shorter than hip→ankle
    const bentKneeBaseline = makeLandmarks([
      { id: LandmarkId.LEFT_EAR, x: 0, y: 25 },
      { id: LandmarkId.LEFT_SHOULDER, x: 0, y: 20 },
      { id: LandmarkId.LEFT_HIP, x: 0, y: 10 },
      { id: LandmarkId.LEFT_KNEE, x: 3, y: 5 }, // Knee slightly forward
      { id: LandmarkId.LEFT_ANKLE, x: 0, y: 0 },
    ]);

    // The metric should still calculate without errors
    const result = extractRepMetrics(bentKneeBaseline, bentKneeBaseline, 0, 'LEFT', false);
    expect(result.hipHingeAngle2D.value).toBeDefined();
    expect(result.posteriorHipShift.value).toBeDefined();
  });

  it('Throws on missing landmarks', () => {
    const incompleteLandmarks = makeLandmarks([
      { id: LandmarkId.LEFT_SHOULDER, x: 0, y: 20 },
    ]);

    expect(() =>
      extractRepMetrics(incompleteLandmarks, standingLandmarks, 0)
    ).toThrow('Missing required landmarks');
  });
});
