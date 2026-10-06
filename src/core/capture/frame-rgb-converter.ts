/**
 * Camera frame → packed RGB converter (worklet-safe).
 *
 * The native pose module (GolfBodyPose.detectVideoFrame) expects tightly
 * packed 8-bit RGB (width * height * 3 bytes, no row padding) of an UPRIGHT
 * image. VisionCamera frames (pixelFormat 'rgb') arrive as BGRA / RGBA
 * (4 bytes) or RGB / RGBX pixels, possibly with row padding (bytesPerRow), in the
 * sensor's native orientation and possibly mirrored.
 *
 * This single pass counter-rotates by `orientation`, un-mirrors, downsamples
 * (nearest neighbour, integer step so the long side ≤ maxLongSide) and packs
 * to RGB. Pure function — runs on the camera thread as a worklet and in Jest.
 *
 * Orientation semantics (VisionCamera Frame.orientation): the pixel data is
 * rotated by `orientation` relative to upright ('right' = +90°, i.e.
 * clockwise in image coordinates); we counter-rotate. Mirroring is undone in
 * the upright image. Verify both on a device (see LivePoseProcessor's
 * onFrameSourceInfo) — they cannot be observed in unit tests.
 *
 * @module frame-rgb-converter
 * @version FRAME_RGB_CONVERTER_V1
 */

export const VERSION = 'FRAME_RGB_CONVERTER_V1';

export type FrameOrientation = 'up' | 'right' | 'down' | 'left';
export type SupportedRgbPixelFormat = 'rgb-bgra-8-bit' | 'rgb-rgba-8-bit' | 'rgb-rgb-8-bit';

export interface PackedRgbImage {
  /** Tightly packed RGB bytes, length = width * height * 3 */
  data: ArrayBuffer;
  width: number;
  height: number;
}

export function isSupportedRgbPixelFormat(format: string): format is SupportedRgbPixelFormat {
  'worklet';
  return format === 'rgb-bgra-8-bit' || format === 'rgb-rgba-8-bit' || format === 'rgb-rgb-8-bit';
}

/**
 * Converts one camera frame to an upright, packed RGB image.
 *
 * @param src          Frame pixel buffer (Frame.getPixelBuffer())
 * @param srcWidth     Frame.width (pixels, in stored orientation)
 * @param srcHeight    Frame.height
 * @param bytesPerRow  Frame.bytesPerRow (≥ srcWidth * 4)
 * @param pixelFormat  Frame.pixelFormat (an 8-bit RGB format)
 * @param orientation  Frame.orientation
 * @param isMirrored   Frame.isMirrored
 * @param maxLongSide  Downsample so the output's long side is at most this
 */
export function convertFrameToPackedRgb(
  src: ArrayBuffer,
  srcWidth: number,
  srcHeight: number,
  bytesPerRow: number,
  pixelFormat: SupportedRgbPixelFormat,
  orientation: FrameOrientation,
  isMirrored: boolean,
  maxLongSide: number,
): PackedRgbImage {
  'worklet';
  const bytes = new Uint8Array(src);
  // 'rgb-rgb-8-bit' may be packed RGB (3 bytes) or RGBX (4 bytes); the BGRA/RGBA
  // formats are always 4 bytes per pixel.
  const bpp = pixelFormat === 'rgb-rgb-8-bit' && bytesPerRow < srcWidth * 4 ? 3 : 4;
  // Channel offsets inside a pixel.
  const rOff = pixelFormat === 'rgb-bgra-8-bit' ? 2 : 0;
  const bOff = pixelFormat === 'rgb-bgra-8-bit' ? 0 : 2;

  const step = Math.max(1, Math.ceil(Math.max(srcWidth, srcHeight) / maxLongSide));
  const sampledW = Math.floor(srcWidth / step);
  const sampledH = Math.floor(srcHeight / step);

  // Upright dimensions: a quarter-turn swaps width and height.
  const quarterTurn = orientation === 'right' || orientation === 'left';
  const outW = quarterTurn ? sampledH : sampledW;
  const outH = quarterTurn ? sampledW : sampledH;
  const out = new Uint8Array(outW * outH * 3);

  let o = 0;
  for (let uy = 0; uy < outH; uy++) {
    for (let uxRaw = 0; uxRaw < outW; uxRaw++) {
      const ux = isMirrored ? outW - 1 - uxRaw : uxRaw;
      // Map the upright (sampled) pixel back to the stored (sampled) pixel.
      let sx: number;
      let sy: number;
      if (orientation === 'right') {
        // stored = upright rotated +90° (clockwise)
        sx = sampledW - 1 - uy;
        sy = ux;
      } else if (orientation === 'left') {
        // stored = upright rotated −90°
        sx = uy;
        sy = sampledH - 1 - ux;
      } else if (orientation === 'down') {
        sx = sampledW - 1 - ux;
        sy = sampledH - 1 - uy;
      } else {
        sx = ux;
        sy = uy;
      }
      const i = sy * step * bytesPerRow + sx * step * bpp;
      out[o] = bytes[i + rOff]!;
      out[o + 1] = bytes[i + 1]!;
      out[o + 2] = bytes[i + bOff]!;
      o += 3;
    }
  }
  return { data: out.buffer, width: outW, height: outH };
}
