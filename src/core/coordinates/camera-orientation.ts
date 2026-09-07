/**
 * Camera Orientation Mapping
 * Experimental validation status.
 */

export const VERSION = 'CAMERA_ORIENTATION_V1';

/**
 * Maps standard device orientation strings to sensor rotation degrees.
 * @param orientation The device orientation string (e.g., from VisionCamera).
 * @returns Rotation in degrees (0, 90, 180, 270).
 */
export function getSensorOrientationFromDevice(orientation: string): number {
  switch (orientation) {
    case 'portrait':
      return 0;
    case 'landscape-left':
      return 90;
    case 'portrait-upside-down':
      return 180;
    case 'landscape-right':
      return 270;
    default:
      return 0;
  }
}
