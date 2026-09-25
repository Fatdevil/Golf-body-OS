/**
 * isotropic.test.ts
 * The same physical pose filmed in portrait (9:16), landscape (16:9) or 4:3
 * must produce the same angles. Without the isotropic mapping a true 150°
 * knee read ~134° in portrait (flagged EXCESSIVE_KNEE_BEND) and ~162° in landscape.
 */

import { toIsotropicLandmarks, isotropicScaleX } from '../../../src/core/coordinates/isotropic';
import { interiorAngle } from '../../../src/core/metrics/angle-calculator';
import { extractRepMetrics } from '../../../src/core/metrics/hip-hinge-metrics';
import { extractPhaseKinematics } from '../../../src/core/metrics/golf-swing-metrics';
import { generate240FpsSwingSequence } from '../../../src/core/data/sample-240fps-swing';
import { Landmark, LandmarkId } from '../../../src/core/types/landmark';
import { PoseFrame } from '../../../src/core/types/pose-frame';

const rad = (d: number) => (d * Math.PI) / 180;

/** Side-view hinge pose in PIXELS: thigh vertical, trunk at `hingeDeg`, shank at `kneeDeg`. */
function hingePosePx(hingeDeg: number, kneeDeg: number): Record<number, [number, number]> {
  const hip: [number, number] = [500, 500];
  const knee: [number, number] = [500, 700];
  const shoulder: [number, number] = [hip[0] + 250 * Math.sin(rad(hingeDeg)), hip[1] + 250 * Math.cos(rad(hingeDeg))];
  const ankle: [number, number] = [knee[0] - 200 * Math.sin(rad(180 - kneeDeg)), knee[1] + 200 * Math.cos(rad(180 - kneeDeg))];
  const ear: [number, number] = [shoulder[0] + (shoulder[0] - hip[0]) * 0.3, shoulder[1] + (shoulder[1] - hip[1]) * 0.3];
  return {
    [LandmarkId.LEFT_EAR]: ear,
    [LandmarkId.LEFT_SHOULDER]: shoulder,
    [LandmarkId.LEFT_HIP]: hip,
    [LandmarkId.LEFT_KNEE]: knee,
    [LandmarkId.LEFT_ANKLE]: ankle,
  };
}

/** Normalize pixel positions the way MediaPipe does: x / width, y / height. */
function normalized(px: Record<number, [number, number]>, w: number, h: number): Landmark[] {
  return Object.entries(px).map(([id, [x, y]]) => ({ id: Number(id) as LandmarkId, x: x / w, y: y / h, visibility: 1 }));
}

const get = (lms: Landmark[], id: LandmarkId) => lms.find((l) => l.id === id)!;

describe('isotropic landmark space', () => {
  test('scale factor is width / height, and 1 when unknown', () => {
    expect(isotropicScaleX(1080, 1920)).toBeCloseTo(0.5625, 9);
    expect(isotropicScaleX(1920, 1080)).toBeCloseTo(1.7778, 4);
    expect(isotropicScaleX(0, 0)).toBe(1);
    expect(isotropicScaleX(undefined, undefined)).toBe(1);
  });

  test.each([
    ['portrait 9:16', 1080, 1920],
    ['landscape 16:9', 1920, 1080],
    ['4:3', 1440, 1080],
  ])('recovers true hinge (125°) and knee (150°) angles in %s', (_label, w, h) => {
    const lms = toIsotropicLandmarks(normalized(hingePosePx(125, 150), w, h), w, h);
    const hinge = interiorAngle(get(lms, LandmarkId.LEFT_SHOULDER), get(lms, LandmarkId.LEFT_HIP), get(lms, LandmarkId.LEFT_KNEE));
    const knee = interiorAngle(get(lms, LandmarkId.LEFT_HIP), get(lms, LandmarkId.LEFT_KNEE), get(lms, LandmarkId.LEFT_ANKLE));
    expect(hinge).toBeCloseTo(125, 6);
    expect(knee).toBeCloseTo(150, 6);
  });

  test('a good 150° knee in portrait no longer trips the knee-angle < 135° rule', () => {
    const w = 1080, h = 1920;
    const raw = normalized(hingePosePx(125, 150), w, h);
    const iso = toIsotropicLandmarks(raw, w, h);

    const distorted = extractRepMetrics(raw, raw, 0, 'LEFT');
    expect(distorted.kneeAngleAtEndpoint.value).toBeLessThan(135); // the old behaviour: ~134°
    expect(distorted.compensations.map((c) => c.triggeredRule)).toContain('KNEE_ANGLE_LT_135');

    const corrected = extractRepMetrics(iso, iso, 0, 'LEFT');
    expect(corrected.kneeAngleAtEndpoint.value).toBeCloseTo(150, 6);
    expect(corrected.compensations.map((c) => c.triggeredRule)).not.toContain('KNEE_ANGLE_LT_135');
  });

  test('swing kinematics are identical for the same pose in different aspect ratios', () => {
    const src = generate240FpsSwingSequence(480);
    const toCanvas = (f: PoseFrame, w: number, h: number): PoseFrame => ({
      ...f,
      width: w,
      height: h,
      // same pixel geometry as the 640×480 source, re-expressed on a w×h canvas
      landmarks: f.landmarks.map((l) => ({
        ...l,
        x: (l.x * f.width) / w,
        y: (l.y * f.height) / h,
        ...(l.z !== undefined ? { z: (l.z * f.width) / w } : {}),
      })),
    });
    const address = src[0]!;
    const top = src[200]!;
    const ref = extractPhaseKinematics(top, 'P4_TOP', address, 'FACE_ON');
    for (const [w, h] of [[1080, 1920], [1920, 1080]] as const) {
      const k = extractPhaseKinematics(toCanvas(top, w, h), 'P4_TOP', toCanvas(address, w, h), 'FACE_ON');
      expect(k.leadElbowAngle).toBeCloseTo(ref.leadElbowAngle, 0);
      expect(k.leadKneeFlexionDeg ?? 0).toBeCloseTo(ref.leadKneeFlexionDeg ?? 0, 0);
      expect(k.spineAngleDelta).toBeCloseTo(ref.spineAngleDelta, 0);
    }
  });
});
