/**
 * live-screening-session.test.ts
 * End-to-end: image-space frames (as the native module returns them) from a
 * PORTRAIT phone video → hip hinge measurement with correct angles.
 */

import { LiveScreeningSession } from '../../../src/core/analysis/live-screening-session';
import { PoseFrame } from '../../../src/core/types/pose-frame';
import { Landmark, LandmarkId } from '../../../src/core/types/landmark';
import { RotationSample } from '../../../src/core/metrics/thoracic-rotation-metrics';

const W = 1080;
const H = 1920;
const FPS = 30;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Side view, golfer facing −x (left side toward camera). Pixel geometry:
 * thigh and shank fixed with a 160° knee; trunk hinges forward so that the
 * shoulder→hip→knee angle equals `hingeDeg`. Image y points down.
 */
function framePx(hingeDeg: number, t: number, id: number): PoseFrame {
  const knee = { x: 540, y: 1400 };
  const hip = { x: knee.x + 450 * Math.sin(rad(10)), y: knee.y - 450 * Math.cos(rad(10)) };   // thigh 10° off vertical
  const ankle = { x: knee.x + 420 * Math.sin(rad(10)), y: knee.y + 420 * Math.cos(rad(10)) }; // shank 10° → knee 160°
  // thigh direction from hip to knee, rotate by hingeDeg (toward −x) to get the trunk direction
  const thighDir = Math.atan2(knee.y - hip.y, knee.x - hip.x);
  const trunkDir = thighDir + rad(hingeDeg); // screen coords: rotating clockwise leans toward −x
  const shoulder = { x: hip.x + 520 * Math.cos(trunkDir), y: hip.y + 520 * Math.sin(trunkDir) };
  const ear = { x: hip.x + 680 * Math.cos(trunkDir), y: hip.y + 680 * Math.sin(trunkDir) };
  const heel = { x: ankle.x + 40, y: ankle.y + 20 };

  const place: Partial<Record<LandmarkId, { x: number; y: number }>> = {
    [LandmarkId.LEFT_EAR]: ear, [LandmarkId.RIGHT_EAR]: ear,
    [LandmarkId.LEFT_SHOULDER]: shoulder, [LandmarkId.RIGHT_SHOULDER]: shoulder,
    [LandmarkId.LEFT_HIP]: hip, [LandmarkId.RIGHT_HIP]: hip,
    [LandmarkId.LEFT_KNEE]: knee, [LandmarkId.RIGHT_KNEE]: knee,
    [LandmarkId.LEFT_ANKLE]: ankle, [LandmarkId.RIGHT_ANKLE]: ankle,
    [LandmarkId.LEFT_HEEL]: heel, [LandmarkId.RIGHT_HEEL]: heel,
  };
  const landmarks: Landmark[] = Array.from({ length: 33 }, (_, i) => {
    const p = place[i as LandmarkId] ?? hip;
    return { id: i as LandmarkId, x: p.x / W, y: p.y / H, z: 0, visibility: 0.95, presence: 0.95 };
  });
  return { frameId: id, timestampMs: t, width: W, height: H, landmarks, model: 'TEST', modelVersion: '1' };
}

/** 3 reps: stand → hinge to `bottomDeg` → hold → stand. */
function hingeSession(bottomDeg: number): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const phase = (deg0: number, deg1: number, sec: number) => {
    const n = Math.round(sec * FPS);
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const deg = deg0 + (deg1 - deg0) * (0.5 - 0.5 * Math.cos(Math.PI * p));
      frames.push(framePx(deg, (frames.length * 1000) / FPS, frames.length));
    }
  };
  phase(178, 178, 1.0);
  for (let r = 0; r < 3; r++) {
    phase(178, bottomDeg, 1.2);
    phase(bottomDeg, bottomDeg, 0.8);
    phase(bottomDeg, 178, 1.2);
    phase(178, 178, 0.8);
  }
  return frames;
}

describe('LiveScreeningSession', () => {
  test('measures hinge and knee angles correctly from portrait image-space frames', () => {
    const session = new LiveScreeningSession();
    for (const f of hingeSession(100)) session.addHingeFrame(f);

    const m = session.finalizeHinge();
    expect(m).not.toBeNull();
    expect(m!.repCount).toBe(3);
    expect(m!.hingeAngle).toBeCloseTo(100, 0);
    expect(m!.kneeAngle).toBeCloseTo(160, 0);
    // a correct 160° knee is not a knee-dominant squat
    expect(m!.compensations).not.toContain('EXCESSIVE_KNEE_BEND');
  });

  test('returns null (abstains) when no frames or no repetitions were captured', () => {
    const empty = new LiveScreeningSession();
    expect(empty.finalizeHinge()).toBeNull();

    const standingOnly = new LiveScreeningSession();
    for (let i = 0; i < 90; i++) standingOnly.addHingeFrame(framePx(178, (i * 1000) / FPS, i));
    expect(standingOnly.finalizeHinge()).toBeNull();
  });

  test('summarizes rotation samples, or abstains without samples', () => {
    expect(LiveScreeningSession.summarizeRotation([])).toBeNull();

    const samples: RotationSample[] = [
      { timestampMs: 0, frameId: 0, shoulderRotation: 0, pelvicRotation: 0, isolatedThoracic: 0, lateralTilt: 0 },
      { timestampMs: 500, frameId: 1, shoulderRotation: 50, pelvicRotation: 10, isolatedThoracic: 40, lateralTilt: 3 },
      { timestampMs: 1000, frameId: 2, shoulderRotation: -40, pelvicRotation: -8, isolatedThoracic: -32, lateralTilt: -2 },
    ];
    const r = LiveScreeningSession.summarizeRotation(samples)!;
    expect(r.leftDeg).toBe(40);
    expect(r.rightDeg).toBe(32);
    expect(r.asymmetryDeg).toBe(8);
    expect(r.pelvicTurnDeg).toBe(10);
  });
});
