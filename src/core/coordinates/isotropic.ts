/**
 * Isotropic landmark space.
 *
 * MediaPipe returns x normalized by image WIDTH and y normalized by image
 * HEIGHT (z uses roughly the same scale as x). Angles and distance ratios
 * computed directly on those values are distorted whenever the image is not
 * square: in a 9:16 portrait video a true 150° knee angle reads ~134°, in a
 * 16:9 landscape video ~162°.
 *
 * This maps landmarks into a space where one unit is the same physical length
 * on every axis (units of image height): x and z are multiplied by
 * width / height, y is unchanged. Use it before any angle, inclination or
 * cross-axis ratio. Do NOT use it for drawing or "is inside the frame" checks,
 * which need plain normalized [0, 1] coordinates.
 *
 * @module isotropic
 * @version ISOTROPIC_SPACE_V1
 */

import { Landmark } from '../types/landmark';
import { PoseFrame } from '../types/pose-frame';

export const VERSION = 'ISOTROPIC_SPACE_V1';

/** Horizontal scale factor (width / height), or 1 when dimensions are unknown. */
export function isotropicScaleX(width: number | undefined, height: number | undefined): number {
  return width && height && width > 0 && height > 0 ? width / height : 1;
}

/** Maps normalized image landmarks into isotropic space (x, z scaled by width / height). */
export function toIsotropicLandmarks(
  landmarks: readonly Landmark[],
  width: number | undefined,
  height: number | undefined,
): Landmark[] {
  const k = isotropicScaleX(width, height);
  if (k === 1) return landmarks.map((lm) => ({ ...lm }));
  return landmarks.map((lm) => ({
    ...lm,
    x: lm.x * k,
    ...(lm.z !== undefined ? { z: lm.z * k } : {}),
  }));
}

/**
 * Returns a copy of the frame whose image landmarks are in isotropic space.
 * World landmarks are already metric and are left unchanged.
 */
export function toIsotropicFrame(frame: PoseFrame): PoseFrame {
  return {
    ...frame,
    landmarks: toIsotropicLandmarks(frame.landmarks, frame.width, frame.height),
  };
}
