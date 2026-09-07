/**
 * Preview Transform logic extracted for modularity.
 * Experimental validation status.
 */

export const VERSION = 'PREVIEW_TRANSFORM_V1';

import { calculateAspectFillTransform } from './coordinate-transform';

/**
 * Computes aspect-fill scaling, crop offsets for a given image and preview size.
 * @param imageWidth Image width
 * @param imageHeight Image height
 * @param previewWidth Preview width
 * @param previewHeight Preview height
 * @returns Scale and offsets
 */
export function getPreviewTransform(
  imageWidth: number,
  imageHeight: number,
  previewWidth: number,
  previewHeight: number
): { scale: number; offsetX: number; offsetY: number } {
  return calculateAspectFillTransform(imageWidth, imageHeight, previewWidth, previewHeight);
}
