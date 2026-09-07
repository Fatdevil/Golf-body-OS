/**
 * Defines the various coordinate spaces used in the Golf Body OS measurement pipeline.
 * Proper management of these spaces is critical for accurate measurements.
 */
export enum CoordinateSpace {
  /**
   * Raw coordinates directly from the image sensor, typically in unrotated pixel values.
   */
  SENSOR = 'SENSOR',

  /**
   * Rotated pixel coordinates corresponding to the final processed image frame.
   */
  IMAGE = 'IMAGE',

  /**
   * Normalized coordinates [0, 1] relative to the processed image frame.
   * This is the format output by MediaPipe.
   */
  NORMALIZED_IMAGE = 'NORMALIZED_IMAGE',

  /**
   * Pixel coordinates on the device screen where the preview is rendered.
   * Accounts for aspect-fill cropping, scaling, and potential mirroring.
   */
  PREVIEW = 'PREVIEW',

  /**
   * A unified metric space aligned with gravity where Y points UP.
   * Useful for calculating true physical angles and distances.
   */
  BODY_METRIC = 'BODY_METRIC',

  /**
   * 3D world coordinates, typically in meters relative to a body center.
   * Provided by MediaPipe world landmarks.
   */
  WORLD_LANDMARK = 'WORLD_LANDMARK',
}

export const VERSION = 'COORDINATE_SPACE_V1';
