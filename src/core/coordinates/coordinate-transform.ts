/**
 * Coordinate Transform Engine
 * Experimental validation status.
 */

import { CoordinateSpace } from './coordinate-space';

export const VERSION = 'COORDINATE_TRANSFORM_V1';

export interface Point2D {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TransformParams {
  /** 0, 90, 180, 270 degrees. Rotation of the sensor relative to portrait. */
  sensorOrientation: number;
  imageWidth: number;
  imageHeight: number;
  previewWidth: number;
  previewHeight: number;
  isMirrored: boolean;
  /** From IMU, normalized */
  gravityVector: Vector3;
}

/**
 * Calculates the aspect-fill scale and offsets.
 * @param imageWidth Width of the image.
 * @param imageHeight Height of the image.
 * @param previewWidth Width of the preview view.
 * @param previewHeight Height of the preview view.
 * @returns Object containing scale, offsetX, and offsetY.
 */
export function calculateAspectFillTransform(
  imageWidth: number,
  imageHeight: number,
  previewWidth: number,
  previewHeight: number
): { scale: number; offsetX: number; offsetY: number } {
  const imageAspect = imageWidth / imageHeight;
  const previewAspect = previewWidth / previewHeight;

  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (previewAspect > imageAspect) {
    // Preview is wider than image. Scale by width.
    scale = previewWidth / imageWidth;
    offsetY = (previewHeight - imageHeight * scale) / 2;
  } else {
    // Preview is taller than image (or equal). Scale by height.
    scale = previewHeight / imageHeight;
    offsetX = (previewWidth - imageWidth * scale) / 2;
  }

  return { scale, offsetX, offsetY };
}

/**
 * Maps MediaPipe [0,1] coords to screen pixel coords, accounting for aspect-fill scaling, offset, and mirroring.
 * @param point Normalized point [0,1].
 * @param params Transform parameters.
 * @returns Point in preview pixel coordinates.
 */
export function normalizedToPreview(point: Point2D, params: TransformParams): Point2D {
  let x = point.x;
  const y = point.y;

  if (params.isMirrored) {
    x = 1 - x;
  }

  // Convert to image pixel coordinates
  const px = x * params.imageWidth;
  const py = y * params.imageHeight;

  const { scale, offsetX, offsetY } = calculateAspectFillTransform(
    params.imageWidth,
    params.imageHeight,
    params.previewWidth,
    params.previewHeight
  );

  return {
    x: px * scale + offsetX,
    y: py * scale + offsetY,
  };
}

/**
 * Maps preview pixel coordinates back to normalized MediaPipe [0,1] coords.
 * Inverse of normalizedToPreview.
 * @param point Preview pixel coordinates.
 * @param params Transform parameters.
 * @returns Normalized point [0,1].
 */
export function previewToNormalized(point: Point2D, params: TransformParams): Point2D {
  const { scale, offsetX, offsetY } = calculateAspectFillTransform(
    params.imageWidth,
    params.imageHeight,
    params.previewWidth,
    params.previewHeight
  );

  // Invert scaling and offset
  const px = (point.x - offsetX) / scale;
  const py = (point.y - offsetY) / scale;

  // Convert back to normalized coordinates
  let x = px / params.imageWidth;
  const y = py / params.imageHeight;

  if (params.isMirrored) {
    x = 1 - x;
  }

  return { x, y };
}

/**
 * Rotates a 2D point to align with true vertical based on gravity.
 *
 * **IMPORTANT: This function assumes PORTRAIT device orientation.**
 * The gravity vector is interpreted as expressed in the device's native
 * portrait reference frame, where Y is along the long axis.
 *
 * If the device is in landscape mode, the caller MUST pre-rotate the
 * gravity vector by `sensorOrientation` degrees before passing it here.
 * Failure to do so will produce incorrect gravity alignment.
 *
 * @param point 2D point to rotate.
 * @param gravityVector Normalized gravity vector in device portrait frame.
 * @returns Rotated 2D point aligned to true vertical.
 */
export function rotateByGravity(point: Point2D, gravityVector: Vector3): Point2D {
  // Gravity vector points towards the ground.
  // In standard iOS/Android portrait, gravity (0, -1, 0) means device is upright.
  // We calculate the tilt angle of the gravity vector in the XY plane.
  // NOTE: This assumes portrait orientation — see JSDoc above.
  const angle = Math.atan2(gravityVector.x, -gravityVector.y);

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Rotate point
  return {
    x: point.x * cosA - point.y * sinA,
    y: point.x * sinA + point.y * cosA,
  };
}

/**
 * Maps MediaPipe [0,1] coords to gravity-aligned space where Y points UP.
 * Uses gravityVector for alignment.
 * @param point Normalized point [0,1].
 * @param params Transform parameters.
 * @returns Point in BODY_METRIC space.
 */
export function normalizedToBodyMetric(point: Point2D, params: TransformParams): Point2D {
  // 1. Shift to center [-0.5, 0.5] to rotate around the middle
  const centered = {
    x: point.x - 0.5,
    y: point.y - 0.5,
  };

  // 2. Flip Y so positive Y is up (standard Cartesian)
  centered.y = -centered.y;

  // 3. Rotate by gravity to align with true vertical
  const aligned = rotateByGravity(centered, params.gravityVector);

  return aligned;
}
